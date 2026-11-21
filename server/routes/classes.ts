// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel — grup dersleri (Pilates): gruplar, dersler, katılım.
 * Yetki: randevularla aynı (appointments:read / appointments:write) — sağlık verisi içermez.
 */
import { prisma, type Prisma } from '../lib/db';
import { HttpError, badRequest, body, conflict, notFound, param, parse, query, router } from '../lib/http';
import { audit } from '../lib/audit';
import { authUser, requirePermission } from '../auth/session';
import { withAppointmentLock } from '../services/availability';
import {
  assertClassSlot,
  assertClientsExist,
  capacityError,
  expandWeeklySlots,
  getSessionOr404,
  groupInclude,
  seatsTaken,
  sessionInclude,
  setGroupMembers,
  toGroupDTOs,
  toSessionDTO,
} from '../services/classes';
import {
  classAttendanceUpdateSchema,
  classAttendeeAddSchema,
  classGroupCreateSchema,
  classGroupMembersSchema,
  classGroupNoteSchema,
  classGroupNoteUpdateSchema,
  classGroupUpdateSchema,
  classRecurringSchema,
  classSessionCreateSchema,
  classSessionListQuerySchema,
  classSessionStatusSchema,
  classSessionUpdateSchema,
} from '../../shared/schemas';
import { CLASS_SEAT_HOLDING, type ClassAttendanceStatus, type ClassSessionStatus } from '../../shared/constants';
import type { ClassGroupNoteDTO, ClassRecurringResult, ClientClassSummary } from '../../shared/classes';
import { decryptNote, encryptNote } from '../services/recipe-notes';
import { pushToClient, shortWhen } from '../services/push';
import { addDays, endOfDayExclusive, startOfDay, toDateStr, toTimeStr } from '../../shared/time';

export const classesRouter = router();
const canRead = requirePermission('appointments:read');
const canWrite = requirePermission('appointments:write');

// ───────────────────────── Gruplar ─────────────────────────

classesRouter.get('/groups', canRead, async (c) => {
  const groups = await prisma.classGroup.findMany({ include: groupInclude, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  return c.json({ items: await toGroupDTOs(groups) });
});

classesRouter.get('/groups/:id', canRead, async (c) => {
  const g = await prisma.classGroup.findUnique({ where: { id: param(c) }, include: groupInclude });
  if (!g) throw notFound('Grup bulunamadı');
  return c.json({ group: (await toGroupDTOs([g]))[0] });
});

classesRouter.post('/groups', canWrite, async (c) => {
  const input = parse(classGroupCreateSchema, await body(c));
  const ids = await assertClientsExist(prisma, input.memberIds);
  if (ids.length > input.capacity) {
    throw new HttpError(422, 'VALIDATION_ERROR', `Bu grup en fazla ${input.capacity} kişilik.`, { fields: { memberIds: `En fazla ${input.capacity} kişi seçebilirsiniz` } });
  }
  const g = await prisma.classGroup.create({
    data: {
      name: input.name,
      capacity: input.capacity,
      defaultDurationMinutes: input.defaultDurationMinutes,
      note: input.note,
      members: { create: ids.map((clientId) => ({ clientId })) },
    },
    include: groupInclude,
  });
  await audit(c, 'class_group.created', 'class_group', g.id, { capacity: g.capacity, members: ids.length });
  return c.json({ group: (await toGroupDTOs([g]))[0] }, 201);
});

classesRouter.patch('/groups/:id', canWrite, async (c) => {
  const id = param(c);
  const input = parse(classGroupUpdateSchema, await body(c));
  const g = await prisma.classGroup.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
  if (!g) throw notFound('Grup bulunamadı');
  if (input.capacity !== undefined && input.capacity < g._count.members) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Kontenjan mevcut üye sayısından az olamaz.', {
      fields: { capacity: `Grupta ${g._count.members} üye var; önce üye çıkarın` },
    });
  }
  const data: Prisma.ClassGroupUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.capacity !== undefined) data.capacity = input.capacity;
  if (input.defaultDurationMinutes !== undefined) data.defaultDurationMinutes = input.defaultDurationMinutes;
  if ('note' in ((await body(c)) as object)) data.note = input.note;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  const row = await prisma.classGroup.update({ where: { id }, data, include: groupInclude });
  await audit(c, 'class_group.updated', 'class_group', id, { fields: Object.keys(data) });
  return c.json({ group: (await toGroupDTOs([row]))[0] });
});

classesRouter.put('/groups/:id/members', canWrite, async (c) => {
  const id = param(c);
  const input = parse(classGroupMembersSchema, await body(c));
  const sync = await withAppointmentLock((tx) => setGroupMembers(tx, id, input.memberIds, input.syncUpcoming));
  await audit(c, 'class_group.members_changed', 'class_group', id, { members: input.memberIds.length, ...sync });
  const g = await prisma.classGroup.findUniqueOrThrow({ where: { id }, include: groupInclude });
  return c.json({ group: (await toGroupDTOs([g]))[0], sync });
});

// ───────────── Grup not defteri (yapılanlar / yapılacaklar) ─────────────

const noteSelect = {
  id: true, kind: true, noteDate: true, bodyEnc: true, createdAt: true, updatedAt: true,
  createdBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ClassGroupNoteSelect;
type NoteRow = Prisma.ClassGroupNoteGetPayload<{ select: typeof noteSelect }>;
const toNoteDTO = (n: NoteRow): ClassGroupNoteDTO => ({
  id: n.id,
  kind: n.kind,
  noteDate: n.noteDate,
  body: decryptNote(n.bodyEnc),
  author: n.createdBy ? `${n.createdBy.firstName} ${n.createdBy.lastName}`.trim() : null,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

classesRouter.get('/groups/:id/notes', canRead, async (c) => {
  const groupId = param(c);
  const notes = await prisma.classGroupNote.findMany({ where: { groupId }, select: noteSelect, orderBy: [{ createdAt: 'desc' }], take: 300 });
  return c.json({ items: notes.map(toNoteDTO) });
});

classesRouter.post('/groups/:id/notes', canWrite, async (c) => {
  const groupId = param(c);
  const input = parse(classGroupNoteSchema, await body(c));
  const g = await prisma.classGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!g) throw notFound('Grup bulunamadı');
  const n = await prisma.classGroupNote.create({
    data: { groupId, kind: input.kind, noteDate: input.noteDate ?? null, bodyEnc: encryptNote(input.body)!, createdById: authUser(c).id },
    select: noteSelect,
  });
  await audit(c, 'class_group.note_added', 'class_group', groupId, { kind: input.kind });
  return c.json({ note: toNoteDTO(n) }, 201);
});

classesRouter.patch('/notes/:id', canWrite, async (c) => {
  const id = param(c);
  const input = parse(classGroupNoteUpdateSchema, await body(c));
  const existing = await prisma.classGroupNote.findUnique({ where: { id }, select: { groupId: true } });
  if (!existing) throw notFound('Not bulunamadı');
  const n = await prisma.classGroupNote.update({
    where: { id },
    data: {
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.noteDate !== undefined ? { noteDate: input.noteDate } : {}),
      ...(input.body !== undefined ? { bodyEnc: encryptNote(input.body)! } : {}),
    },
    select: noteSelect,
  });
  await audit(c, 'class_group.note_updated', 'class_group', existing.groupId, { fields: Object.keys(input) });
  return c.json({ note: toNoteDTO(n) });
});

classesRouter.delete('/notes/:id', canWrite, async (c) => {
  const id = param(c);
  const existing = await prisma.classGroupNote.findUnique({ where: { id }, select: { groupId: true } });
  if (!existing) throw notFound('Not bulunamadı');
  await prisma.classGroupNote.delete({ where: { id } });
  await audit(c, 'class_group.note_deleted', 'class_group', existing.groupId);
  return c.json({ ok: true });
});

classesRouter.delete('/groups/:id', canWrite, async (c) => {
  const id = param(c);
  const g = await prisma.classGroup.findUnique({ where: { id }, select: { id: true } });
  if (!g) throw notFound('Grup bulunamadı');
  const upcoming = await prisma.classSession.count({ where: { groupId: id, status: 'SCHEDULED', startsAt: { gt: new Date() } } });
  if (upcoming) {
    throw conflict('GROUP_HAS_UPCOMING', `Bu grubun ${upcoming} planlı dersi var. Önce dersleri iptal edin ya da grubu pasife alın.`);
  }
  // Geçmiş dersler kalır (groupId boşalır, ders adı korunur)
  await prisma.classGroup.delete({ where: { id } });
  await audit(c, 'class_group.deleted', 'class_group', id);
  return c.json({ ok: true });
});

/** Tekrarlayan ders planı: seçilen gün/saatlerde N hafta boyunca ders oluşturur; uygun olmayan tarihler atlanır */
classesRouter.post('/groups/:id/recurring', canWrite, async (c) => {
  const id = param(c);
  const input = parse(classRecurringSchema, await body(c));
  const group = await prisma.classGroup.findUnique({ where: { id }, include: { members: true } });
  if (!group) throw notFound('Grup bulunamadı');
  if (!group.isActive) throw conflict('GROUP_INACTIVE', 'Pasif gruba ders eklenemez. Önce grubu aktifleştirin.');
  const duration = input.durationMinutes ?? group.defaultDurationMinutes;
  const candidates = expandWeeklySlots(input.startDate, input.weeks, input.slots);
  const userId = authUser(c).id;

  const result = await withAppointmentLock(async (tx) => {
    const out: ClassRecurringResult = { created: 0, skipped: [] };
    for (const { date, time } of candidates) {
      let times: { startsAt: Date; endsAt: Date };
      try {
        times = await assertClassSlot(tx, { date, time, durationMinutes: duration }, { enforceHours: !input.allowOutsideHours });
      } catch (e) {
        if (e instanceof HttpError && e.status === 409) {
          out.skipped.push({ date, time, reason: e.message });
          continue;
        }
        throw e;
      }
      await tx.classSession.create({
        data: {
          groupId: group.id,
          title: group.name,
          ...times,
          capacity: group.capacity,
          createdById: userId,
          attendees: { create: group.members.map((m) => ({ clientId: m.clientId })) },
        },
      });
      out.created++;
    }
    return out;
  });
  await audit(c, 'class_session.recurring_created', 'class_group', id, { created: result.created, skipped: result.skipped.length, weeks: input.weeks });
  return c.json(result, result.created ? 201 : 200);
});

// ───────────────────────── Dersler ─────────────────────────

classesRouter.get('/sessions', canRead, async (c) => {
  const q = parse(classSessionListQuerySchema, query(c));
  if (q.to > addDays(q.from, 93)) throw badRequest('En fazla 3 aylık aralık listelenebilir.');
  const where: Prisma.ClassSessionWhereInput = {
    startsAt: { gte: startOfDay(q.from), lt: endOfDayExclusive(q.to) },
    ...(q.includeCancelled === '1' ? {} : { status: { not: 'CANCELLED' } }),
    ...(q.groupId ? { groupId: q.groupId } : {}),
    ...(q.clientId ? { attendees: { some: { clientId: q.clientId } } } : {}),
  };
  const rows = await prisma.classSession.findMany({ where, include: sessionInclude, orderBy: { startsAt: 'asc' }, take: 1000 });
  return c.json({ items: rows.map(toSessionDTO) });
});

classesRouter.get('/sessions/:id', canRead, async (c) => {
  return c.json({ session: toSessionDTO(await getSessionOr404(param(c))) });
});

classesRouter.post('/sessions', canWrite, async (c) => {
  const input = parse(classSessionCreateSchema, await body(c));
  const userId = authUser(c).id;
  const created = await withAppointmentLock(async (tx) => {
    let title = input.title ?? '';
    let capacity = input.capacity;
    let duration = input.durationMinutes;
    let clientIds = input.clientIds ?? [];
    let groupId: string | null = null;
    if (input.groupId) {
      const g = await tx.classGroup.findUnique({ where: { id: input.groupId }, include: { members: true } });
      if (!g) throw notFound('Grup bulunamadı');
      if (!g.isActive) throw conflict('GROUP_INACTIVE', 'Pasif gruba ders eklenemez. Önce grubu aktifleştirin.');
      groupId = g.id;
      title = input.title || g.name;
      capacity ??= g.capacity;
      duration ??= g.defaultDurationMinutes;
      clientIds = [...g.members.map((m) => m.clientId), ...clientIds];
    }
    capacity ??= 3;
    duration ??= 50;
    const ids = await assertClientsExist(tx, clientIds);
    if (ids.length > capacity) throw capacityError(capacity);
    const times = await assertClassSlot(tx, { date: input.date, time: input.time, durationMinutes: duration }, { enforceHours: !input.allowOutsideHours });
    return tx.classSession.create({
      data: {
        groupId,
        title,
        ...times,
        capacity,
        note: input.note,
        createdById: userId,
        attendees: { create: ids.map((clientId) => ({ clientId })) },
      },
      include: sessionInclude,
    });
  });
  await audit(c, 'class_session.created', 'class_session', created.id, { groupId: created.groupId, attendees: created.attendees.length });
  return c.json({ session: toSessionDTO(created) }, 201);
});

classesRouter.patch('/sessions/:id', canWrite, async (c) => {
  const id = param(c);
  const raw = (await body(c)) as Record<string, unknown>;
  const input = parse(classSessionUpdateSchema, raw);
  const row = await withAppointmentLock(async (tx) => {
    const s = await getSessionOr404(id, tx);
    const data: Prisma.ClassSessionUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if ('note' in raw) data.note = input.note;
    if (input.capacity !== undefined) {
      if (input.capacity < seatsTaken(s.attendees)) {
        throw new HttpError(422, 'VALIDATION_ERROR', 'Kontenjan mevcut katılımcı sayısından az olamaz.', { fields: { capacity: `Derste ${seatsTaken(s.attendees)} kişi kayıtlı` } });
      }
      data.capacity = input.capacity;
    }
    const timeChange = input.date !== undefined || input.time !== undefined || input.durationMinutes !== undefined;
    if (timeChange) {
      if (s.status !== 'SCHEDULED') throw conflict('INVALID_TRANSITION', 'Yalnızca planlı derslerin zamanı değiştirilebilir.');
      const date = input.date ?? toDateStr(s.startsAt);
      const time = input.time ?? toTimeStr(s.startsAt);
      const duration = input.durationMinutes ?? Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
      const times = await assertClassSlot(tx, { date, time, durationMinutes: duration, ignoreSessionId: id }, { enforceHours: !input.allowOutsideHours });
      data.startsAt = times.startsAt;
      data.endsAt = times.endsAt;
    }
    return tx.classSession.update({ where: { id }, data, include: sessionInclude });
  });
  await audit(c, 'class_session.updated', 'class_session', id, { fields: Object.keys(input).filter((k) => k !== 'allowOutsideHours') });
  return c.json({ session: toSessionDTO(row) });
});

/** İzin verilen ders durum geçişleri */
const SESSION_TRANSITIONS: Record<ClassSessionStatus, ClassSessionStatus[]> = {
  SCHEDULED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['SCHEDULED'],
  CANCELLED: ['SCHEDULED'],
};

classesRouter.post('/sessions/:id/status', canWrite, async (c) => {
  const id = param(c);
  const { status: to } = parse(classSessionStatusSchema, await body(c));
  let cancelled = false;
  const row = await withAppointmentLock(async (tx) => {
    const s = await getSessionOr404(id, tx);
    const from = s.status as ClassSessionStatus;
    if (from === to) return s;
    cancelled = to === 'CANCELLED';
    if (!SESSION_TRANSITIONS[from].includes(to)) throw conflict('INVALID_TRANSITION', 'Bu ders bu duruma alınamaz.');
    if (to === 'COMPLETED') {
      if (s.startsAt > new Date()) throw conflict('NOT_STARTED', 'Henüz başlamamış bir ders "yapıldı" olarak işaretlenemez.');
      // Sonuçlanmamış kayıtlar "katıldı" sayılır; gelmeyenler ayrıca işaretlenir
      await tx.classAttendance.updateMany({ where: { sessionId: id, status: 'BOOKED' }, data: { status: 'ATTENDED' } });
    }
    if (from === 'CANCELLED' && to === 'SCHEDULED') {
      // Yeniden planlanan iptal ders: arada dolmuş olabilecek saat tekrar kontrol edilir
      const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000);
      await assertClassSlot(tx, { date: toDateStr(s.startsAt), time: toTimeStr(s.startsAt), durationMinutes: duration, ignoreSessionId: id }, { enforceHours: false, allowPast: true });
    }
    return tx.classSession.update({ where: { id }, data: { status: to }, include: sessionInclude });
  });
  await audit(c, 'class_session.status_changed', 'class_session', id, { to });
  // İleri tarihli ders iptal edildi → kayıtlı danışanların mobil uygulamasına
  if (cancelled && row.startsAt > new Date()) {
    for (const a of row.attendees) {
      if (!CLASS_SEAT_HOLDING.includes(a.status as ClassAttendanceStatus)) continue;
      pushToClient(a.clientId, { title: 'Pilates dersin iptal edildi', body: shortWhen(row.startsAt), url: '/hesabim/pilates', data: { type: 'CLASS_CANCELLED' } });
    }
  }
  return c.json({ session: toSessionDTO(row) });
});

classesRouter.delete('/sessions/:id', canWrite, async (c) => {
  const s = await prisma.classSession.findUnique({ where: { id: param(c) }, select: { id: true, status: true } });
  if (!s) throw notFound('Ders bulunamadı');
  if (s.status === 'COMPLETED') throw conflict('NOT_DELETABLE', 'Yapılmış dersler silinemez; katılım geçmişi için saklanır.');
  await prisma.classSession.delete({ where: { id: s.id } });
  await audit(c, 'class_session.deleted', 'class_session', s.id, { status: s.status });
  return c.json({ ok: true });
});

// ───────────────────────── Katılımcılar ─────────────────────────

classesRouter.post('/sessions/:id/attendees', canWrite, async (c) => {
  const id = param(c);
  const { clientId } = parse(classAttendeeAddSchema, await body(c));
  const row = await withAppointmentLock(async (tx) => {
    const s = await getSessionOr404(id, tx);
    if (s.status === 'CANCELLED') throw conflict('SESSION_CANCELLED', 'İptal edilmiş derse katılımcı eklenemez.');
    await assertClientsExist(tx, [clientId]);
    const existing = s.attendees.find((a) => a.clientId === clientId);
    if (existing && existing.status !== 'EXCUSED') throw conflict('ALREADY_ATTENDING', 'Bu danışan zaten bu derste.');
    if (seatsTaken(s.attendees) >= s.capacity) throw capacityError(s.capacity);
    if (existing) await tx.classAttendance.update({ where: { id: existing.id }, data: { status: 'BOOKED' } });
    else await tx.classAttendance.create({ data: { sessionId: id, clientId } });
    return getSessionOr404(id, tx);
  });
  await audit(c, 'class_session.attendee_added', 'class_session', id, { clientId });
  return c.json({ session: toSessionDTO(row) });
});

classesRouter.patch('/sessions/:id/attendees/:clientId', canWrite, async (c) => {
  const id = param(c);
  const clientId = param(c, 'clientId');
  const { status } = parse(classAttendanceUpdateSchema, await body(c));
  const row = await withAppointmentLock(async (tx) => {
    const s = await getSessionOr404(id, tx);
    const att = s.attendees.find((a) => a.clientId === clientId);
    if (!att) throw notFound('Katılımcı bu derste değil');
    if (s.status === 'CANCELLED') throw conflict('SESSION_CANCELLED', 'İptal edilmiş derste katılım güncellenemez.');
    if ((status === 'ATTENDED' || status === 'NO_SHOW') && s.startsAt > new Date()) {
      throw conflict('NOT_STARTED', 'Ders başlamadan "katıldı" veya "gelmedi" işaretlenemez.');
    }
    const wasHolding = CLASS_SEAT_HOLDING.includes(att.status as ClassAttendanceStatus);
    const willHold = CLASS_SEAT_HOLDING.includes(status);
    if (!wasHolding && willHold && seatsTaken(s.attendees) >= s.capacity) throw capacityError(s.capacity);
    await tx.classAttendance.update({ where: { id: att.id }, data: { status } });
    return getSessionOr404(id, tx);
  });
  await audit(c, 'class_session.attendance_changed', 'class_session', id, { clientId, status });
  return c.json({ session: toSessionDTO(row) });
});

classesRouter.delete('/sessions/:id/attendees/:clientId', canWrite, async (c) => {
  const id = param(c);
  const clientId = param(c, 'clientId');
  const s = await getSessionOr404(id);
  const att = s.attendees.find((a) => a.clientId === clientId);
  if (!att) throw notFound('Katılımcı bu derste değil');
  await prisma.classAttendance.delete({ where: { id: att.id } });
  await audit(c, 'class_session.attendee_removed', 'class_session', id, { clientId });
  return c.json({ session: toSessionDTO(await getSessionOr404(id)) });
});

// ───────────────────────── Danışan özeti ─────────────────────────

classesRouter.get('/clients/:clientId', canRead, async (c) => {
  const clientId = param(c, 'clientId');
  const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!exists) throw notFound('Danışan bulunamadı');
  const now = new Date();
  const [memberships, upcoming, past, counts] = await Promise.all([
    prisma.classGroupMember.findMany({ where: { clientId }, include: { group: { select: { id: true, name: true, isActive: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.classSession.findMany({
      where: { attendees: { some: { clientId } }, status: 'SCHEDULED', startsAt: { gte: now } },
      include: sessionInclude,
      orderBy: { startsAt: 'asc' },
      take: 20,
    }),
    prisma.classSession.findMany({
      where: { attendees: { some: { clientId } }, OR: [{ startsAt: { lt: now } }, { status: { not: 'SCHEDULED' } }] },
      include: sessionInclude,
      orderBy: { startsAt: 'desc' },
      take: 30,
    }),
    prisma.classAttendance.groupBy({ by: ['status'], where: { clientId, session: { status: 'COMPLETED' } }, _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const mine = (s: (typeof upcoming)[number]) => ({ ...toSessionDTO(s), myStatus: s.attendees.find((a) => a.clientId === clientId)!.status as ClassAttendanceStatus });
  const summary: ClientClassSummary = {
    groups: memberships.map((m) => m.group),
    upcoming: upcoming.map(mine),
    past: past.map(mine),
    stats: { attended: count('ATTENDED'), noShow: count('NO_SHOW'), excused: count('EXCUSED') },
  };
  return c.json(summary);
});
