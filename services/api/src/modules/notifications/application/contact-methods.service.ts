import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type {
  ContactKind,
  ContactMethodView,
  CreateContactMethodInput,
  NotificationTestResult,
} from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { checkOutboundUrl, UnsafeUrlError } from '../../../core/common/outbound-url';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { contactMethods } from '../../../core/db/schema';
import { testNotification } from '../domain/messages';
import { DeliveryLedger, type AttemptRow } from './delivery-ledger.service';

export type ContactRow = typeof contactMethods.$inferSelect;

const MAX_METHODS = 10;

export function testResultOf(row: AttemptRow | undefined): NotificationTestResult {
  if (!row)
    return {
      ok: false,
      state: 'failed_permanent',
      status: null,
      error: 'Not sent',
      providerMessageId: null,
    };
  return {
    ok: row.state === 'delivered' || row.state === 'provider_accepted',
    state: row.state as NotificationTestResult['state'],
    status: row.responseStatus,
    error: row.error,
    providerMessageId: row.providerMessageId,
  };
}

const toView = (r: ContactRow): ContactMethodView => ({
  id: r.id,
  kind: r.kind as ContactKind,
  address: r.address,
  minSeverity: r.minSeverity,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class ContactMethodsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly ledger: DeliveryLedger,
  ) {}

  private mine(actor: ActorContext) {
    return and(
      eq(contactMethods.workspaceId, actor.workspaceId),
      eq(contactMethods.userId, actor.userId),
    );
  }

  async list(actor: ActorContext): Promise<ContactMethodView[]> {
    const rows = await this.db
      .select()
      .from(contactMethods)
      .where(this.mine(actor))
      .orderBy(asc(contactMethods.createdAt));
    return rows.map(toView);
  }

  async create(actor: ActorContext, input: CreateContactMethodInput): Promise<ContactMethodView> {
    const existing = await this.list(actor);
    if (existing.length >= MAX_METHODS)
      throw new ApiException(
        HttpStatus.CONFLICT,
        'too_many_contact_methods',
        `At most ${MAX_METHODS} contact methods`,
      );
    if (input.kind === 'push') {
      try {
        await checkOutboundUrl(input.address, { allowPrivate: this.env.NODE_ENV !== 'production' });
      } catch (err) {
        if (err instanceof UnsafeUrlError)
          throw new ApiException(HttpStatus.BAD_REQUEST, 'unsafe_url', err.message);
        throw err;
      }
    }
    const [row] = await this.db
      .insert(contactMethods)
      .values({
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        kind: input.kind,
        address: input.address.trim(),
        minSeverity: input.minSeverity ?? 'low',
      })
      .returning();
    return toView(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const deleted = await this.db
      .delete(contactMethods)
      .where(and(eq(contactMethods.id, id), this.mine(actor)))
      .returning({ id: contactMethods.id });
    if (deleted.length === 0) throw notFound('Contact method');
  }

  async test(actor: ActorContext, id: string): Promise<NotificationTestResult> {
    const [row] = await this.db
      .select()
      .from(contactMethods)
      .where(and(eq(contactMethods.id, id), this.mine(actor)));
    if (!row) throw notFound('Contact method');
    const key = `test:${randomUUID()}`;
    const ids = await this.ledger.enqueue(this.db, [
      {
        workspaceId: actor.workspaceId,
        incidentId: null,
        userId: actor.userId,
        dedupKey: key,
        eventType: 'test',
        channel: row.kind as ContactKind,
        address: row.address,
        payload: testNotification(actor.workspaceId, key, `${this.env.WEB_URL}/notifications`),
      },
    ]);
    const [sent] = await this.ledger.deliverNow(ids);
    return testResultOf(sent);
  }

  forUsers(workspaceId: string, userIds: string[]): Promise<ContactRow[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.db
      .select()
      .from(contactMethods)
      .where(
        and(eq(contactMethods.workspaceId, workspaceId), inArray(contactMethods.userId, userIds)),
      );
  }
}
