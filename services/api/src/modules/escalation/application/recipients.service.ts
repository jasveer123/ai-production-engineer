import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DeliveryChannel, PersonChannel, Severity } from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  notificationChannels,
  users,
  workspaceMembers,
  type StoredStep,
} from '../../../core/db/schema';
import { OncallService } from '../../oncall/application/oncall.service';
import { ContactMethodsService } from '../../notifications/application/contact-methods.service';
import {
  channelDisplay,
  deliveryChannelOf,
} from '../../notifications/application/notification-dispatcher.service';
import { severityAtLeast } from '../../notifications/domain/messages';

export interface PlannedDelivery {
  userId: string | null;
  channelId: string | null;
  name: string;
  channel: DeliveryChannel;
  address: string;
  problem: string | null;
}

interface Person {
  userId: string;
  email: string;
  name: string | null;
}

const CHANNEL_LABEL: Record<PersonChannel, string> = {
  email: 'e-mail',
  sms: 'SMS number',
  call: 'phone number',
  push: 'push',
};

@Injectable()
export class RecipientsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly oncall: OncallService,
    private readonly contacts: ContactMethodsService,
  ) {}

  /** Resolves a step to concrete deliveries at execution time (schedules are read now, not at run start). */
  async plan(
    workspaceId: string,
    step: StoredStep,
    severity: Severity,
  ): Promise<PlannedDelivery[]> {
    const people = await this.people(workspaceId, step);
    const channels = step.channels?.length ? step.channels : (['email'] as PersonChannel[]);
    const methods = await this.contacts.forUsers(
      workspaceId,
      people.map((p) => p.userId),
    );
    const planned: PlannedDelivery[] = [];
    for (const person of people) {
      const name = person.name ?? person.email;
      for (const channel of channels) {
        if (channel === 'email') {
          planned.push({
            userId: person.userId,
            channelId: null,
            name,
            channel,
            address: person.email,
            problem: null,
          });
          continue;
        }
        const matching = methods.filter(
          (m) =>
            m.userId === person.userId &&
            m.kind === channel &&
            severityAtLeast(severity, m.minSeverity),
        );
        if (matching.length === 0)
          planned.push({
            userId: person.userId,
            channelId: null,
            name,
            channel,
            address: '—',
            problem: `${name} has no ${CHANNEL_LABEL[channel]} set up for ${severity} incidents`,
          });
        for (const m of matching)
          planned.push({
            userId: person.userId,
            channelId: null,
            name,
            channel,
            address: m.address,
            problem: null,
          });
      }
    }
    return [...planned, ...(await this.channelTargets(workspaceId, step))];
  }

  private async people(workspaceId: string, step: StoredStep): Promise<Person[]> {
    const ids = new Set<string>();
    let everyone = false;
    for (const t of step.targets) {
      if (t.kind === 'everyone') everyone = true;
      else if (t.kind === 'user' && t.userId) ids.add(t.userId);
      else if (t.kind === 'schedule' && t.scheduleId) {
        const person = await this.oncall.currentOnCall(workspaceId, t.scheduleId);
        // An empty schedule must not swallow the page: fall back to the whole team.
        if (person) ids.add(person.userId);
        else everyone = true;
      }
    }
    if (!everyone && ids.size === 0) return [];
    return this.db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          everyone ? sql`true` : inArray(users.id, [...ids]),
        ),
      );
  }

  private async channelTargets(workspaceId: string, step: StoredStep): Promise<PlannedDelivery[]> {
    const ids = step.targets.flatMap((t) =>
      t.kind === 'channel' && t.channelId ? [t.channelId] : [],
    );
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.workspaceId, workspaceId),
          inArray(notificationChannels.id, ids),
        ),
      );
    return ids.map((id) => {
      const row = rows.find((r) => r.id === id);
      if (!row)
        return {
          userId: null,
          channelId: null,
          name: 'Removed channel',
          channel: 'webhook',
          address: '—',
          problem: 'The channel was deleted',
        };
      return {
        userId: null,
        channelId: row.id,
        name: row.name,
        channel: deliveryChannelOf(row.kind),
        address: channelDisplay(row),
        problem: row.enabled ? null : `${row.name} is turned off`,
      };
    });
  }
}
