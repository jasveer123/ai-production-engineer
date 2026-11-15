import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import {
  MAX_OVERRIDE_DAYS,
  type CreateOverrideInput,
  type CreateScheduleInput,
  type OncallNow,
  type OncallPerson,
  type OverrideView,
  type ScheduleCoverage,
  type ScheduleView,
  type UpdateScheduleInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  oncallOverrides,
  oncallSchedules,
  users,
  workspaceMembers,
  type StoredLayer,
} from '../../../core/db/schema';
import {
  participantIdsOf,
  resolveCoverage,
  rulesOf,
  storedLayers,
  toShift,
  type ResolvedCoverage,
} from './schedule-evaluator';

type ScheduleRow = typeof oncallSchedules.$inferSelect;
type OverrideRow = typeof oncallOverrides.$inferSelect;

const UPCOMING_DAYS = 14;
const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class OncallService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  private async people(workspaceId: string, ids: string[]): Promise<Map<string, OncallPerson>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ userId: users.id, name: users.name, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(users.id, ids)));
    return new Map(rows.map((r) => [r.userId, r]));
  }

  private async requireMembers(workspaceId: string, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    const found = await this.people(workspaceId, unique);
    if (found.size !== unique.length)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'not_a_member',
        'Everyone on a schedule must be a member of this workspace',
      );
  }

  async find(workspaceId: string, id: string): Promise<ScheduleRow> {
    const [row] = await this.db
      .select()
      .from(oncallSchedules)
      .where(and(eq(oncallSchedules.id, id), eq(oncallSchedules.workspaceId, workspaceId)));
    if (!row) throw notFound('Schedule');
    return row;
  }

  private overridesIn(workspaceId: string, ids: string[], from: Date, to: Date) {
    return this.db
      .select()
      .from(oncallOverrides)
      .where(
        and(
          eq(oncallOverrides.workspaceId, workspaceId),
          inArray(oncallOverrides.scheduleId, ids),
          gt(oncallOverrides.endsAt, from),
          lt(oncallOverrides.startsAt, to),
        ),
      )
      .orderBy(asc(oncallOverrides.startsAt));
  }

  async evaluate(workspaceId: string, row: ScheduleRow, from: Date, to: Date) {
    const rules = rulesOf(row);
    const overrides = await this.overridesIn(workspaceId, [row.id], from, to);
    const ids = [...participantIdsOf(rules), ...overrides.map((o) => o.userId)];
    const people = await this.people(workspaceId, [...new Set(ids)]);
    return { rules, overrides, people, ...resolveCoverage(rules, overrides, people, { from, to }) };
  }

  private view(
    row: ScheduleRow,
    data: ResolvedCoverage & { overrides: OverrideRow[]; people: Map<string, OncallPerson> },
    now: Date,
  ): ScheduleView {
    const rules = rulesOf(row);
    const first = data.intervals[0];
    const person = (id: string) => data.people.get(id);
    return {
      id: row.id,
      name: row.name,
      timezone: row.timezone,
      rotationHours: row.rotationHours,
      anchorAt: row.anchorAt.toISOString(),
      layers: rules.layers.map((l) => ({
        id: l.id,
        name: l.name,
        rotation: l.rotation,
        participants: l.participants.flatMap((id) => person(id) ?? []),
        restrictions: l.restrictions,
      })),
      participants: participantIdsOf(rules).flatMap((id) => person(id) ?? []),
      current: first && first.startsAt === now.toISOString() ? toShift(first) : null,
      upcoming: data.intervals.map(toShift),
      gaps: data.gaps,
      overrides: data.overrides.flatMap((o): OverrideView[] => {
        const p = person(o.userId);
        return p
          ? [
              {
                id: o.id,
                person: p,
                startsAt: o.startsAt.toISOString(),
                endsAt: o.endsAt.toISOString(),
              },
            ]
          : [];
      }),
      calendarEnabled: Boolean(row.calendarTokenHash),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async build(workspaceId: string, row: ScheduleRow, now = new Date()) {
    const data = await this.evaluate(
      workspaceId,
      row,
      now,
      new Date(now.getTime() + UPCOMING_DAYS * DAY_MS),
    );
    return this.view(row, data, now);
  }

  async list(actor: ActorContext): Promise<ScheduleView[]> {
    const rows = await this.db
      .select()
      .from(oncallSchedules)
      .where(eq(oncallSchedules.workspaceId, actor.workspaceId))
      .orderBy(asc(oncallSchedules.createdAt));
    const now = new Date();
    return Promise.all(rows.map((r) => this.build(actor.workspaceId, r, now)));
  }

  async now(actor: ActorContext): Promise<OncallNow[]> {
    const views = await this.list(actor);
    return views.map((v) => ({ scheduleId: v.id, scheduleName: v.name, shift: v.current }));
  }

  async currentOnCall(workspaceId: string, scheduleId: string): Promise<OncallPerson | null> {
    const [row] = await this.db
      .select()
      .from(oncallSchedules)
      .where(and(eq(oncallSchedules.id, scheduleId), eq(oncallSchedules.workspaceId, workspaceId)));
    if (!row) return null;
    const now = new Date();
    const { intervals } = await this.evaluate(workspaceId, row, now, new Date(now.getTime() + 1));
    return intervals[0]?.person ?? null;
  }

  async coverage(actor: ActorContext, id: string, from: Date, to: Date): Promise<ScheduleCoverage> {
    const row = await this.find(actor.workspaceId, id);
    const { intervals, gaps } = await this.evaluate(actor.workspaceId, row, from, to);
    return {
      scheduleId: row.id,
      timezone: row.timezone,
      from: from.toISOString(),
      to: to.toISOString(),
      intervals,
      gaps,
    };
  }

  private layersFrom(
    input: CreateScheduleInput | UpdateScheduleInput,
    fallback?: ScheduleRow,
  ): StoredLayer[] {
    if (input.layers?.length) return storedLayers(input.layers);
    if (!input.participantIds?.length && fallback) return fallback.layers;
    return [
      {
        id: 'default',
        name: 'Rotation',
        rotation: {
          kind: 'elapsed',
          hours: input.rotationHours ?? fallback?.rotationHours ?? 168,
          anchorAt: input.anchorAt ?? fallback?.anchorAt.toISOString() ?? new Date().toISOString(),
        },
        participants: [...new Set(input.participantIds ?? [])],
        restrictions: [],
      },
    ];
  }

  async create(actor: ActorContext, input: CreateScheduleInput): Promise<ScheduleView> {
    const layers = this.layersFrom(input);
    const participants = [...new Set(layers.flatMap((l) => l.participants))];
    await this.requireMembers(actor.workspaceId, participants);
    const [row] = await this.db
      .insert(oncallSchedules)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        timezone: input.timezone ?? 'UTC',
        layers,
        rotationHours: input.rotationHours ?? 168,
        anchorAt: input.anchorAt ? new Date(input.anchorAt) : new Date(),
        participants,
        createdBy: actor.userId,
      })
      .returning();
    await this.record(actor, 'oncall.schedule_created', row!.id);
    return this.build(actor.workspaceId, row!);
  }

  async update(actor: ActorContext, id: string, input: UpdateScheduleInput): Promise<ScheduleView> {
    const current = await this.find(actor.workspaceId, id);
    const touchesLayers = Boolean(
      input.layers || input.participantIds || input.rotationHours || input.anchorAt,
    );
    const layers = touchesLayers ? this.layersFrom(input, current) : current.layers;
    const participants = [...new Set(layers.flatMap((l) => l.participants))];
    if (touchesLayers) await this.requireMembers(actor.workspaceId, participants);
    const [row] = await this.db
      .update(oncallSchedules)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.rotationHours ? { rotationHours: input.rotationHours } : {}),
        ...(input.anchorAt ? { anchorAt: new Date(input.anchorAt) } : {}),
        ...(touchesLayers ? { layers, participants } : {}),
      })
      .where(and(eq(oncallSchedules.id, id), eq(oncallSchedules.workspaceId, actor.workspaceId)))
      .returning();
    await this.record(actor, 'oncall.schedule_updated', id);
    return this.build(actor.workspaceId, row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.find(actor.workspaceId, id);
    await this.db
      .delete(oncallSchedules)
      .where(and(eq(oncallSchedules.id, id), eq(oncallSchedules.workspaceId, actor.workspaceId)));
    await this.record(actor, 'oncall.schedule_deleted', id);
  }

  async addOverride(
    actor: ActorContext,
    scheduleId: string,
    input: CreateOverrideInput,
  ): Promise<ScheduleView> {
    await this.requireMembers(actor.workspaceId, [input.userId]);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt.getTime() - startsAt.getTime() > MAX_OVERRIDE_DAYS * DAY_MS)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'override_too_long',
        `An override can last at most ${MAX_OVERRIDE_DAYS} days`,
      );
    const schedule = await this.db.transaction(async (tx) => {
      // Locking the schedule row serialises override writers, so two overlapping requests cannot both pass the check.
      const [locked] = await tx
        .select()
        .from(oncallSchedules)
        .where(
          and(
            eq(oncallSchedules.id, scheduleId),
            eq(oncallSchedules.workspaceId, actor.workspaceId),
          ),
        )
        .for('update');
      if (!locked) throw notFound('Schedule');
      const [clash] = await tx
        .select({ id: oncallOverrides.id })
        .from(oncallOverrides)
        .where(
          and(
            eq(oncallOverrides.scheduleId, scheduleId),
            gt(oncallOverrides.endsAt, startsAt),
            lt(oncallOverrides.startsAt, endsAt),
          ),
        )
        .limit(1);
      if (clash)
        throw new ApiException(
          HttpStatus.CONFLICT,
          'override_overlaps',
          'Another override already covers part of this time',
        );
      await tx.insert(oncallOverrides).values({
        workspaceId: actor.workspaceId,
        scheduleId,
        userId: input.userId,
        startsAt,
        endsAt,
        createdBy: actor.userId,
      });
      return locked;
    });
    await this.record(actor, 'oncall.override_created', scheduleId, { userId: input.userId });
    return this.build(actor.workspaceId, schedule);
  }

  async removeOverride(actor: ActorContext, overrideId: string): Promise<void> {
    const [row] = await this.db
      .delete(oncallOverrides)
      .where(
        and(eq(oncallOverrides.id, overrideId), eq(oncallOverrides.workspaceId, actor.workspaceId)),
      )
      .returning({ scheduleId: oncallOverrides.scheduleId });
    if (!row) throw notFound('Override');
    await this.record(actor, 'oncall.override_deleted', row.scheduleId);
  }

  record(actor: ActorContext, action: string, id: string, metadata = {}) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'oncall_schedule',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }
}
