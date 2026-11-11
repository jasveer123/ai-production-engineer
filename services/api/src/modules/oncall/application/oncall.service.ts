import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import {
  MAX_OVERRIDE_DAYS,
  type CreateOverrideInput,
  type CreateScheduleInput,
  type OncallNow,
  type OncallPerson,
  type OncallShift,
  type OverrideView,
  type ScheduleView,
  type UpdateScheduleInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { oncallOverrides, oncallSchedules, users, workspaceMembers } from '../../../core/db/schema';
import { onCallAt, shiftsBetween, type Shift } from '../domain/shifts';

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
    const found = await this.people(workspaceId, [...new Set(ids)]);
    if (found.size !== new Set(ids).size)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'not_a_member',
        'Everyone on a schedule must be a member of this workspace',
      );
  }

  private async find(actor: ActorContext, id: string): Promise<ScheduleRow> {
    const [row] = await this.db
      .select()
      .from(oncallSchedules)
      .where(and(eq(oncallSchedules.id, id), eq(oncallSchedules.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Schedule');
    return row;
  }

  private shiftView(shift: Shift, people: Map<string, OncallPerson>): OncallShift | null {
    const person = people.get(shift.userId);
    return person
      ? {
          person,
          startsAt: shift.startsAt.toISOString(),
          endsAt: shift.endsAt.toISOString(),
          override: shift.override,
        }
      : null;
  }

  private async build(
    workspaceId: string,
    rows: ScheduleRow[],
    now = new Date(),
  ): Promise<ScheduleView[]> {
    if (rows.length === 0) return [];
    const overrides = await this.db
      .select()
      .from(oncallOverrides)
      .where(
        and(
          eq(oncallOverrides.workspaceId, workspaceId),
          inArray(
            oncallOverrides.scheduleId,
            rows.map((r) => r.id),
          ),
          gt(oncallOverrides.endsAt, now),
        ),
      )
      .orderBy(asc(oncallOverrides.startsAt));
    const ids = new Set<string>();
    rows.forEach((r) => r.participants.forEach((id) => ids.add(id)));
    overrides.forEach((o) => ids.add(o.userId));
    const people = await this.people(workspaceId, [...ids]);
    const until = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);

    return rows.map((row) => {
      const mine = overrides.filter((o) => o.scheduleId === row.id);
      const windows = mine.map((o) => ({
        userId: o.userId,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
      }));
      const rotation = {
        anchorAt: row.anchorAt,
        rotationHours: row.rotationHours,
        participants: row.participants.filter((id) => people.has(id)),
      };
      const current = onCallAt(rotation, windows, now);
      const upcoming = shiftsBetween(rotation, windows, now, until)
        .map((shift) => this.shiftView(shift, people))
        .filter((shift): shift is OncallShift => shift !== null);
      return {
        id: row.id,
        name: row.name,
        rotationHours: row.rotationHours,
        anchorAt: row.anchorAt.toISOString(),
        participants: rotation.participants.map((id) => people.get(id)!),
        current: current ? this.shiftView(current, people) : null,
        upcoming,
        overrides: mine.flatMap((o: OverrideRow): OverrideView[] => {
          const person = people.get(o.userId);
          return person
            ? [
                {
                  id: o.id,
                  person,
                  startsAt: o.startsAt.toISOString(),
                  endsAt: o.endsAt.toISOString(),
                },
              ]
            : [];
        }),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async list(actor: ActorContext): Promise<ScheduleView[]> {
    const rows = await this.db
      .select()
      .from(oncallSchedules)
      .where(eq(oncallSchedules.workspaceId, actor.workspaceId))
      .orderBy(asc(oncallSchedules.createdAt));
    return this.build(actor.workspaceId, rows);
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
    const [view] = await this.build(workspaceId, [row]);
    return view?.current?.person ?? null;
  }

  async create(actor: ActorContext, input: CreateScheduleInput): Promise<ScheduleView> {
    const participantIds = [...new Set(input.participantIds)];
    await this.requireMembers(actor.workspaceId, participantIds);
    const [row] = await this.db
      .insert(oncallSchedules)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        rotationHours: input.rotationHours ?? 168,
        anchorAt: input.anchorAt ? new Date(input.anchorAt) : new Date(),
        participants: participantIds,
        createdBy: actor.userId,
      })
      .returning();
    await this.record(actor, 'oncall.schedule_created', row!.id);
    return (await this.build(actor.workspaceId, [row!]))[0]!;
  }

  async update(actor: ActorContext, id: string, input: UpdateScheduleInput): Promise<ScheduleView> {
    await this.find(actor, id);
    if (input.participantIds)
      await this.requireMembers(actor.workspaceId, [...new Set(input.participantIds)]);
    const [row] = await this.db
      .update(oncallSchedules)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.rotationHours ? { rotationHours: input.rotationHours } : {}),
        ...(input.anchorAt ? { anchorAt: new Date(input.anchorAt) } : {}),
        ...(input.participantIds ? { participants: [...new Set(input.participantIds)] } : {}),
      })
      .where(and(eq(oncallSchedules.id, id), eq(oncallSchedules.workspaceId, actor.workspaceId)))
      .returning();
    await this.record(actor, 'oncall.schedule_updated', id);
    return (await this.build(actor.workspaceId, [row!]))[0]!;
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.find(actor, id);
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
    const schedule = await this.find(actor, scheduleId);
    await this.requireMembers(actor.workspaceId, [input.userId]);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt.getTime() - startsAt.getTime() > MAX_OVERRIDE_DAYS * DAY_MS)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'override_too_long',
        `An override can last at most ${MAX_OVERRIDE_DAYS} days`,
      );
    const clash = await this.db
      .select({
        id: oncallOverrides.id,
        startsAt: oncallOverrides.startsAt,
        endsAt: oncallOverrides.endsAt,
      })
      .from(oncallOverrides)
      .where(and(eq(oncallOverrides.scheduleId, scheduleId), gt(oncallOverrides.endsAt, startsAt)));
    if (clash.some((o) => o.startsAt < endsAt))
      throw new ApiException(
        HttpStatus.CONFLICT,
        'override_overlaps',
        'Another override already covers part of this time',
      );
    await this.db.insert(oncallOverrides).values({
      workspaceId: actor.workspaceId,
      scheduleId,
      userId: input.userId,
      startsAt,
      endsAt,
      createdBy: actor.userId,
    });
    await this.record(actor, 'oncall.override_created', scheduleId, { userId: input.userId });
    return (await this.build(actor.workspaceId, [schedule]))[0]!;
  }

  async removeOverride(actor: ActorContext, overrideId: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(oncallOverrides)
      .where(
        and(eq(oncallOverrides.id, overrideId), eq(oncallOverrides.workspaceId, actor.workspaceId)),
      );
    if (!row) throw notFound('Override');
    await this.db
      .delete(oncallOverrides)
      .where(
        and(eq(oncallOverrides.id, overrideId), eq(oncallOverrides.workspaceId, actor.workspaceId)),
      );
    await this.record(actor, 'oncall.override_deleted', row.scheduleId);
  }

  private record(actor: ActorContext, action: string, id: string, metadata = {}) {
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
