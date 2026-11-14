// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Grup dersleri (Pilates) iş mantığı
 * ──────────────────────────────────
 *  - Grup: sabit üyeler + kontenjan (varsayılan 3). Üye sayısı kontenjanı aşamaz.
 *  - Ders: tarihli oturum. Gruptan oluşturulursa üyeler otomatik katılımcı olur; telafi/misafir eklenebilir.
 *  - Kontenjan: "haber verdi" (EXCUSED) dışındaki katılımlar yer tutar.
 *  - Takvim: planlı/yapılmış dersler randevularla aynı kilit altında yazılır ve çakışma kontrolüne girer
 *    (randevu ↔ ders arasında günün dinlenme süresi uygulanır; ders ↔ ders arasında yalnızca örtüşme engellenir).
 */
import { prisma, type Prisma, type Tx } from '../lib/db';
import { conflict, notFound, HttpError } from '../lib/http';
import { assertSlotAllowed } from './availability';
import { CLASS_SEAT_HOLDING, HARD_CONFLICT_STATUSES, type ClassAttendanceStatus, type ClassSessionStatus } from '../../shared/constants';
import type { ClassClientRef, ClassGroupDTO, ClassMemberSyncResult, ClassSessionDTO } from '../../shared/classes';
import { addDays, isoWeekday, toDateStr, toTimeStr } from '../../shared/time';

const clientRef = { select: { id: true, firstName: true, lastName: true, phone: true } } as const;

export const sessionInclude = {
  group: { select: { id: true, name: true, members: { select: { clientId: true } } } },
  attendees: { include: { client: clientRef }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ClassSessionInclude;

export type SessionRow = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;

export function seatsTaken(attendees: { status: string }[]) {
  return attendees.filter((a) => CLASS_SEAT_HOLDING.includes(a.status as ClassAttendanceStatus)).length;
}

export function toSessionDTO(s: SessionRow): ClassSessionDTO {
  const members = new Set(s.group?.members.map((m) => m.clientId) ?? []);
  return {
    id: s.id,
    groupId: s.groupId,
    groupName: s.group?.name ?? null,
    title: s.title,
    status: s.status as ClassSessionStatus,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    date: toDateStr(s.startsAt),
    time: toTimeStr(s.startsAt),
    durationMinutes: Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000),
    capacity: s.capacity,
    seatsTaken: seatsTaken(s.attendees),
    note: s.note,
    attendees: s.attendees.map((a) => ({
      clientId: a.clientId,
      status: a.status as ClassAttendanceStatus,
      client: a.client,
      isMember: members.has(a.clientId),
    })),
  };
}

export async function getSessionOr404(id: string, db: Tx | typeof prisma = prisma) {
  const s = await db.classSession.findUnique({ where: { id }, include: sessionInclude });
  if (!s) throw notFound('Ders bulunamadı');
  return s;
}

/**
 * Bir ders aralığını doğrular: çalışma saatleri (isteğe bağlı), onaylı randevular (+ dinlenme süresi)
 * ve diğer dersler (yalnızca örtüşme). Hata 409 olarak fırlatılır.
 */
export function assertClassSlot(
  tx: Tx,
  input: { date: string; time: string; durationMinutes: number; ignoreSessionId?: string },
  opts: { enforceHours: boolean; allowPast?: boolean },
) {
  return assertSlotAllowed(
    tx,
    { date: input.date, time: input.time, durationMinutes: input.durationMinutes, ignoreClassSessionId: input.ignoreSessionId },
    { statuses: HARD_CONFLICT_STATUSES, enforceHours: opts.enforceHours, allowPast: opts.allowPast ?? false, classBufferMinutes: 0 },
  );
}

/** İstenen danışanların var olduğunu doğrular; yinelenenleri ayıklar */
export async function assertClientsExist(db: Tx | typeof prisma, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const found = await db.client.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) throw notFound('Seçilen danışanlardan biri bulunamadı');
  return unique;
}

export function capacityError(capacity: number) {
  return conflict('CLASS_FULL', `Kontenjan dolu (${capacity} kişi). Önce kontenjanı artırın veya bir katılımcıyı çıkarın.`);
}

// ───────────────────────── Gruplar ─────────────────────────

export const groupInclude = {
  members: { include: { client: clientRef }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ClassGroupInclude;
type GroupRow = Prisma.ClassGroupGetPayload<{ include: typeof groupInclude }>;

/** Grupların düzeni (gün + saat), sonraki dersi ve planlı ders sayısı */
export async function toGroupDTOs(groups: GroupRow[]): Promise<ClassGroupDTO[]> {
  if (!groups.length) return [];
  const now = new Date();
  const horizon = new Date(now.getTime() + 28 * 864e5);
  const upcoming = await prisma.classSession.findMany({
    where: { groupId: { in: groups.map((g) => g.id) }, status: 'SCHEDULED', startsAt: { gte: now } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, groupId: true, startsAt: true },
  });
  return groups.map((g) => {
    const mine = upcoming.filter((s) => s.groupId === g.id);
    const pattern = new Map<string, { weekday: number; time: string }>();
    for (const s of mine.filter((x) => x.startsAt < horizon)) {
      const weekday = isoWeekday(toDateStr(s.startsAt));
      const time = toTimeStr(s.startsAt);
      pattern.set(`${weekday}-${time}`, { weekday, time });
    }
    const members: ClassClientRef[] = g.members.map((m) => m.client);
    return {
      id: g.id,
      name: g.name,
      capacity: g.capacity,
      defaultDurationMinutes: g.defaultDurationMinutes,
      note: g.note,
      isActive: g.isActive,
      members,
      pattern: [...pattern.values()].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time)),
      nextSession: mine[0] ? { id: mine[0].id, startsAt: mine[0].startsAt.toISOString() } : null,
      upcomingCount: mine.length,
      createdAt: g.createdAt.toISOString(),
    };
  });
}

/**
 * Grup üyeliğini değiştirir. syncUpcoming: gelecekteki planlı derslerde ayrılan üyelerin (henüz sonuçlanmamış)
 * kaydı silinir, yeni üyeler yer varsa eklenir.
 */
export async function setGroupMembers(tx: Tx, groupId: string, memberIds: string[], syncUpcoming: boolean): Promise<ClassMemberSyncResult> {
  const group = await tx.classGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group) throw notFound('Grup bulunamadı');
  const ids = await assertClientsExist(tx, memberIds);
  if (ids.length > group.capacity) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Bu grup en fazla ${group.capacity} kişilik.`, { fields: { memberIds: `En fazla ${group.capacity} kişi seçebilirsiniz` } });
  }
  const before = new Set(group.members.map((m) => m.clientId));
  const after = new Set(ids);
  const added = ids.filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  if (removed.length) await tx.classGroupMember.deleteMany({ where: { groupId, clientId: { in: removed } } });
  if (added.length) await tx.classGroupMember.createMany({ data: added.map((clientId) => ({ groupId, clientId })) });

  const result: ClassMemberSyncResult = { added: 0, removed: 0, full: 0 };
  if (!syncUpcoming || (!added.length && !removed.length)) return result;

  const sessions = await tx.classSession.findMany({
    where: { groupId, status: 'SCHEDULED', startsAt: { gt: new Date() } },
    include: { attendees: true },
  });
  for (const s of sessions) {
    if (removed.length) {
      const del = await tx.classAttendance.deleteMany({ where: { sessionId: s.id, clientId: { in: removed }, status: { in: ['BOOKED', 'EXCUSED'] } } });
      result.removed += del.count;
    }
    let taken = seatsTaken(s.attendees.filter((a) => !removed.includes(a.clientId)));
    for (const clientId of added) {
      if (s.attendees.some((a) => a.clientId === clientId)) continue;
      if (taken >= s.capacity) {
        result.full++;
        continue;
      }
      await tx.classAttendance.create({ data: { sessionId: s.id, clientId } });
      taken++;
      result.added++;
    }
  }
  return result;
}

// ───────────────────────── Tekrarlayan dersler ─────────────────────────

/** Başlangıç gününden itibaren N hafta içinde, seçilen gün/saatlere düşen tüm (tarih, saat) çiftleri */
export function expandWeeklySlots(startDate: string, weeks: number, slots: { weekday: number; time: string }[]) {
  const out: { date: string; time: string }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(startDate, i);
    const wd = isoWeekday(date);
    for (const s of slots) if (s.weekday === wd) out.push({ date, time: s.time });
  }
  const seen = new Set<string>();
  return out
    .filter((x) => (seen.has(`${x.date} ${x.time}`) ? false : (seen.add(`${x.date} ${x.time}`), true)))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
