// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan yönetimi
 *  - Temel kayıt: clients:read / clients:write / clients:delete
 *  - Klinik veriler (görüşme notları, ölçümler, dosyalar): clinical:read / clinical:write
 *    → ASSISTANT rolü bu uçlara erişemez (403).
 *  - Ölçüm ve dosya yükleme yalnızca sağlık verisi açık rızası kayıtlıysa yapılabilir.
 *  - Notlar, ölçümler ve dosyalar AES-256-GCM ile şifreli saklanır.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma, type Prisma } from '../lib/db';
import { HttpError, badRequest, body, conflict, notFound, parse, query, readUpload, router, sendBuffer, type Ctx } from '../lib/http';
import { deleteClientRecipeImages } from './recipes';
import { decodePlan } from './plans';
import { CIRCUMFERENCES, pickCircumferences, type Circumferences } from '../../shared/measurements';
import { decryptNote } from '../services/recipe-notes';
import { decryptContent } from '../services/recipe-content';
import { recipeImageUrl } from '../../shared/recipe';
import { audit } from '../lib/audit';
import { decryptBuffer, decryptJson, decryptString, encryptBuffer, encryptJson, encryptString } from '../lib/crypto';
import { PRIVATE_UPLOADS, sniffMime } from '../lib/storage';
import { authUser, requirePermission } from '../auth/session';
import { notifyStaff } from '../services/notifications';
import {
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  consultationNoteSchema,
  healthConsentSchema,
  measurementSchema,
} from '../../shared/schemas';
import { clientScope } from '../auth/reviewer';

export const clientsRouter = router();

const canRead = requirePermission('clients:read');
const canWrite = requirePermission('clients:write');
const canDelete = requirePermission('clients:delete');
const clinicalRead = requirePermission('clinical:read');
const clinicalWrite = requirePermission('clinical:write');

const VISIT_STATUSES = ['COMPLETED', 'CONFIRMED'] as const;

function idParam(c: Ctx, key = 'id') {
  const v = c.req.param(key);
  if (typeof v !== 'string' || v.length > 40) throw badRequest('Geçersiz kimlik');
  return v;
}

async function getClientOr404(id: string) {
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c) throw notFound('Danışan bulunamadı');
  return c;
}

function requireConsent(c: { healthConsentAt: Date | null }) {
  if (!c.healthConsentAt) {
    throw conflict(
      'CONSENT_REQUIRED',
      'Bu danışan için sağlık verisi işlenmesine ilişkin açık rıza kaydı yok. Ölçüm ve dosya eklemeden önce açık rızayı alıp kaydedin.',
    );
  }
}

/** Danışan bazlı görüşme özetleri (liste için toplu hesap) */
async function visitStats(clientIds: string[]) {
  const now = new Date();
  const map = new Map<string, { totalVisits: number; lastVisitAt: Date | null; nextAppointmentAt: Date | null; firstAppointmentAt: Date | null }>();
  for (const id of clientIds) map.set(id, { totalVisits: 0, lastVisitAt: null, nextAppointmentAt: null, firstAppointmentAt: null });
  if (!clientIds.length) return map;

  const [completed, last, next, first] = await Promise.all([
    prisma.appointment.groupBy({ by: ['clientId'], where: { clientId: { in: clientIds }, status: 'COMPLETED' }, _count: { _all: true } }),
    prisma.appointment.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds }, status: { in: [...VISIT_STATUSES] }, startsAt: { lte: now } },
      _max: { startsAt: true },
    }),
    prisma.appointment.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds }, status: { in: ['CONFIRMED', 'PENDING'] }, startsAt: { gt: now } },
      _min: { startsAt: true },
    }),
    prisma.appointment.groupBy({ by: ['clientId'], where: { clientId: { in: clientIds }, startsAt: { not: null } }, _min: { startsAt: true } }),
  ]);
  for (const r of completed) if (r.clientId) map.get(r.clientId)!.totalVisits = r._count._all;
  for (const r of last) if (r.clientId) map.get(r.clientId)!.lastVisitAt = r._max.startsAt;
  for (const r of next) if (r.clientId) map.get(r.clientId)!.nextAppointmentAt = r._min.startsAt;
  for (const r of first) if (r.clientId) map.get(r.clientId)!.firstAppointmentAt = r._min.startsAt;
  return map;
}

// ───────────────────────── Liste & oluşturma ─────────────────────────

clientsRouter.get('/', canRead, async (c) => {
  const q = parse(clientListQuerySchema, query(c));
  const where: Prisma.ClientWhereInput = { ...clientScope(c) };
  if (q.status) where.status = q.status;
  else where.status = { not: 'ARCHIVED' };
  if (q.q) {
    const term = q.q.trim();
    const parts = term.split(/\s+/).filter(Boolean);
    const digits = term.replace(/\D/g, '');
    const or: Prisma.ClientWhereInput[] = [
      { firstName: { contains: term } },
      { lastName: { contains: term } },
      { email: { contains: term.toLowerCase() } },
    ];
    // Türkçe büyük/küçük harf (İ/ı) için yerelleştirilmiş varyantlar
    const lower = term.toLocaleLowerCase('tr-TR');
    const upper = term.toLocaleUpperCase('tr-TR');
    for (const v of new Set([lower, upper, lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1)])) {
      if (v !== term) or.push({ firstName: { contains: v } }, { lastName: { contains: v } });
    }
    if (parts.length >= 2) {
      const first = parts.slice(0, -1).join(' ');
      const last = parts[parts.length - 1];
      or.push({ AND: [{ firstName: { contains: first } }, { lastName: { contains: last } }] });
    }
    if (digits.length >= 3) {
      // Telefonlar +90 5xx… biçiminde saklanır; baştaki 0 / 90'ı tolere et
      const d = digits.replace(/^(90|0)(?=5)/, '');
      or.push({ phone: { contains: d } });
    }
    where.OR = or;
  }

  const orderBy: Prisma.ClientOrderByWithRelationInput[] =
    q.sort === 'name' ? [{ firstName: 'asc' }, { lastName: 'asc' }] : q.sort === 'createdAt' ? [{ createdAt: 'asc' }] : [{ createdAt: 'desc' }];

  let rows: Awaited<ReturnType<typeof prisma.client.findMany>>;
  let total: number;
  if (q.sort === '-lastVisit') {
    // Son görüşmeye göre sıralama: tüm eşleşen kimlikler üzerinden hesapla (küçük ölçekli muayenehane için yeterli)
    const all = await prisma.client.findMany({ where, select: { id: true } });
    total = all.length;
    const stats = await visitStats(all.map((a) => a.id));
    const sorted = all
      .map((a) => ({ id: a.id, t: stats.get(a.id)?.lastVisitAt?.getTime() ?? 0 }))
      .sort((a, b) => b.t - a.t)
      .slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
      .map((a) => a.id);
    const found = await prisma.client.findMany({ where: { id: { in: sorted } } });
    rows = sorted.map((id) => found.find((f) => f.id === id)!).filter(Boolean);
  } else {
    [total, rows] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
  }
  const stats = await visitStats(rows.map((r) => r.id));
  return c.json({
    items: rows.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      status: c.status,
      source: c.source,
      createdAt: c.createdAt,
      firstVisitDate: c.firstVisitDate,
      lastVisitAt: stats.get(c.id)?.lastVisitAt ?? null,
      totalVisits: stats.get(c.id)?.totalVisits ?? 0,
      nextAppointmentAt: stats.get(c.id)?.nextAppointmentAt ?? null,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  });
});

clientsRouter.post('/', canWrite, async (c) => {
  const data = parse(clientCreateSchema, await body(c));
  const existing = await prisma.client.findFirst({ where: { phone: data.phone }, select: { id: true, firstName: true, lastName: true } });
  if (existing) {
    throw conflict('DUPLICATE_PHONE', `Bu telefon numarasıyla kayıtlı bir danışan var: ${existing.firstName} ${existing.lastName}`, {
      existingClientId: existing.id,
      fields: { phone: 'Bu numara başka bir danışana kayıtlı' },
    });
  }
  const { kvkkNoticeGiven, ...rest } = data;
  const client = await prisma.client.create({
    data: { ...rest, source: 'PANEL', kvkkNoticeAt: kvkkNoticeGiven ? new Date() : null },
  });
  await audit(c, 'client.created', 'client', client.id);
  await notifyStaff('CLIENT_CREATED', { title: `Yeni danışan kaydı: ${client.firstName} ${client.lastName}`, clientId: client.id });
  return c.json({ client }, 201);
});

// ───────────────────────── Tekil kayıt ─────────────────────────

clientsRouter.get('/:id', canRead, async (c) => {
  const client = await getClientOr404(idParam(c));
  const s = (await visitStats([client.id])).get(client.id)!;
  const nextAppointment = await prisma.appointment.findFirst({
    where: { clientId: client.id, status: { in: ['CONFIRMED', 'PENDING'] }, startsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, startsAt: true, status: true },
  });
  return c.json({
    client,
    stats: { totalVisits: s.totalVisits, lastVisitAt: s.lastVisitAt, nextAppointment, firstAppointmentAt: s.firstAppointmentAt },
  });
});

clientsRouter.patch('/:id', canWrite, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const data = parse(clientUpdateSchema, await body(c));
  if (data.phone) {
    const dupe = await prisma.client.findFirst({ where: { phone: data.phone, id: { not: id } }, select: { id: true } });
    if (dupe) throw conflict('DUPLICATE_PHONE', 'Bu telefon numarası başka bir danışana kayıtlı', { existingClientId: dupe.id, fields: { phone: 'Bu numara başka bir danışana kayıtlı' } });
  }
  const client = await prisma.client.update({ where: { id }, data });
  await audit(c, 'client.updated', 'client', id, { fields: Object.keys(data) });
  return c.json({ client });
});

clientsRouter.post('/:id/kvkk-notice', canWrite, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const client = await prisma.client.update({ where: { id }, data: { kvkkNoticeAt: new Date() } });
  await audit(c, 'client.kvkk_notice_recorded', 'client', id);
  return c.json({ client });
});

/** KVKK kapsamında silme: klinik veriler ve dosyalar kalıcı silinir, randevu geçmişi anonimleştirilir. */
clientsRouter.delete('/:id', canDelete, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const files = await prisma.clientFile.findMany({ where: { clientId: id }, select: { storedName: true } });
  // Kişiye özel tarif varyasyonları cascade ile silinir; fotoğraf dosyaları önceden kaldırılır
  const recipesRemoved = await deleteClientRecipeImages(id);
  await prisma.$transaction([
    prisma.appointment.updateMany({
      where: { clientId: id },
      data: { clientId: null, contactName: 'Silinmiş danışan', contactPhone: '-', contactEmail: null, clientMessage: null, internalNote: null },
    }),
    prisma.notification.updateMany({ where: { clientId: id }, data: { clientId: null } }),
    prisma.client.delete({ where: { id } }), // notlar, ölçümler, dosya kayıtları cascade ile silinir
  ]);
  await Promise.all(files.map((f) => fs.rm(path.join(PRIVATE_UPLOADS, path.basename(f.storedName)), { force: true })));
  await audit(c, 'client.deleted', 'client', id, { filesRemoved: files.length, recipesRemoved });
  return c.json({ ok: true });
});

clientsRouter.get('/:id/appointments', canRead, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const items = await prisma.appointment.findMany({
    where: { clientId: id },
    orderBy: [{ startsAt: { sort: 'desc', nulls: 'first' } }],
    select: {
      id: true, status: true, startsAt: true, endsAt: true, meetingType: true, source: true, createdAt: true,
      service: { select: { id: true, title: true } },
    },
  });
  return c.json({ items });
});

// ───────────────────────── Açık rıza ─────────────────────────

clientsRouter.post('/:id/health-consent', clinicalWrite, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const { granted, note } = parse(healthConsentSchema, await body(c));
  const client = await prisma.client.update({
    where: { id },
    data: granted
      ? { healthConsentAt: new Date(), healthConsentNote: note ?? null, healthConsentWithdrawnAt: null }
      : { healthConsentAt: null, healthConsentWithdrawnAt: new Date(), healthConsentNote: note ?? null },
  });
  await audit(c, granted ? 'client.health_consent_granted' : 'client.health_consent_withdrawn', 'client', id);
  return c.json({ client });
});

// ───────────────────────── Görüşme notları ─────────────────────────

function serializeNote(n: { id: string; contentEnc: string; appointmentId: string | null; createdAt: Date; updatedAt: Date; author: { firstName: string; lastName: string } | null }) {
  let content = '';
  try {
    content = decryptString(n.contentEnc);
  } catch {
    content = '[Bu not çözülemedi — şifreleme anahtarını kontrol edin]';
  }
  return { id: n.id, content, appointmentId: n.appointmentId, author: n.author, createdAt: n.createdAt, updatedAt: n.updatedAt };
}

const noteInclude = { author: { select: { firstName: true, lastName: true } } } as const;

clientsRouter.get('/:id/notes', clinicalRead, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const notes = await prisma.consultationNote.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, include: noteInclude });
  await audit(c, 'clinical.read', 'client', id, { resource: 'notes', count: notes.length });
  return c.json({ items: notes.map(serializeNote) });
});

clientsRouter.post('/:id/notes', clinicalWrite, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const { content, appointmentId } = parse(consultationNoteSchema, await body(c));
  if (appointmentId) {
    const a = await prisma.appointment.findFirst({ where: { id: appointmentId, clientId: id }, select: { id: true } });
    if (!a) throw badRequest('Seçilen randevu bu danışana ait değil');
  }
  const note = await prisma.consultationNote.create({
    data: { clientId: id, appointmentId: appointmentId ?? null, authorId: authUser(c).id, contentEnc: encryptString(content) },
    include: noteInclude,
  });
  await audit(c, 'clinical.note_created', 'client', id, { noteId: note.id });
  return c.json({ note: serializeNote(note) }, 201);
});

clientsRouter.patch('/:id/notes/:noteId', clinicalWrite, async (c) => {
  const id = idParam(c);
  const noteId = idParam(c, 'noteId');
  const existing = await prisma.consultationNote.findFirst({ where: { id: noteId, clientId: id } });
  if (!existing) throw notFound('Not bulunamadı');
  const { content } = parse(consultationNoteSchema.pick({ content: true }), await body(c));
  const note = await prisma.consultationNote.update({ where: { id: noteId }, data: { contentEnc: encryptString(content) }, include: noteInclude });
  await audit(c, 'clinical.note_updated', 'client', id, { noteId });
  return c.json({ note: serializeNote(note) });
});

clientsRouter.delete('/:id/notes/:noteId', clinicalWrite, async (c) => {
  const id = idParam(c);
  const noteId = idParam(c, 'noteId');
  const r = await prisma.consultationNote.deleteMany({ where: { id: noteId, clientId: id } });
  if (!r.count) throw notFound('Not bulunamadı');
  await audit(c, 'clinical.note_deleted', 'client', id, { noteId });
  return c.json({ ok: true });
});

// ───────────────────────── Ölçümler ─────────────────────────

interface MeasurementData extends Partial<Circumferences> { heightCm?: number | null; weightKg?: number | null; targetWeightKg?: number | null; bodyFatPct?: number | null; muscleKg?: number | null; note?: string | null }

function serializeMeasurement(m: { id: string; measuredOn: string; dataEnc: string; createdAt: Date }) {
  let d: MeasurementData = {};
  try {
    d = decryptJson<MeasurementData>(m.dataEnc);
  } catch {
    d = { note: '[Çözülemedi]' };
  }
  const bmi = d.heightCm && d.weightKg ? Math.round((d.weightKg / (d.heightCm / 100) ** 2) * 10) / 10 : null;
  return {
    id: m.id,
    measuredOn: m.measuredOn,
    heightCm: d.heightCm ?? null,
    weightKg: d.weightKg ?? null,
    targetWeightKg: d.targetWeightKg ?? null,
    bodyFatPct: d.bodyFatPct ?? null,
    muscleKg: d.muscleKg ?? null,
    ...pickCircumferences(d),
    note: d.note ?? null,
    bmi,
    createdAt: m.createdAt,
  };
}

clientsRouter.get('/:id/measurements', clinicalRead, async (c) => {
  const id = idParam(c);
  const client = await getClientOr404(id);
  const rows = await prisma.measurement.findMany({ where: { clientId: id }, orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }] });
  await audit(c, 'clinical.read', 'client', id, { resource: 'measurements', count: rows.length });
  return c.json({ items: rows.map(serializeMeasurement), consent: !!client.healthConsentAt });
});

clientsRouter.post('/:id/measurements', clinicalWrite, async (c) => {
  const id = idParam(c);
  requireConsent(await getClientOr404(id));
  const { measuredOn, ...data } = parse(measurementSchema, await body(c));
  const hasValue = data.heightCm != null || data.weightKg != null || data.targetWeightKg != null || data.bodyFatPct != null || data.muscleKg != null || CIRCUMFERENCES.some(({ key }) => data[key] != null);
  if (!hasValue && !data.note) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'En az bir ölçüm değeri girin', { fields: { weightKg: 'En az bir ölçüm değeri girin' } });
  }
  const m = await prisma.measurement.create({
    data: { clientId: id, measuredOn, dataEnc: encryptJson(data), createdById: authUser(c).id },
  });
  await audit(c, 'clinical.measurement_created', 'client', id, { measurementId: m.id });
  return c.json({ measurement: serializeMeasurement(m) }, 201);
});

clientsRouter.delete('/:id/measurements/:mid', clinicalWrite, async (c) => {
  const id = idParam(c);
  const mid = idParam(c, 'mid');
  const r = await prisma.measurement.deleteMany({ where: { id: mid, clientId: id } });
  if (!r.count) throw notFound('Ölçüm bulunamadı');
  await audit(c, 'clinical.measurement_deleted', 'client', id, { measurementId: mid });
  return c.json({ ok: true });
});

// ───────────────────────── Dosyalar ─────────────────────────

const ALLOWED_FILE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function sanitizeName(name: string) {
  const n = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
  return (n || 'dosya').slice(0, 160);
}

const fileSelect = {
  id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true, visibleToClient: true,
  uploadedBy: { select: { firstName: true, lastName: true } },
} as const;

clientsRouter.get('/:id/files', clinicalRead, async (c) => {
  const id = idParam(c);
  await getClientOr404(id);
  const items = await prisma.clientFile.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, select: fileSelect });
  return c.json({ items });
});

clientsRouter.post(
  '/:id/files',
  clinicalWrite,
  async (c) => {
    const file = await readUpload(c, { maxBytes: 10 * 1024 * 1024, tooLarge: new HttpError(413, 'FILE_TOO_LARGE', 'Dosya en fazla 10 MB olabilir') });
    const id = idParam(c);
    requireConsent(await getClientOr404(id));
    if (!file) throw badRequest('Dosya seçilmedi');
    const mime = sniffMime(file.buffer);
    if (!mime || !ALLOWED_FILE_MIME.has(mime)) throw new HttpError(415, 'UNSUPPORTED_FILE', 'Yalnızca PDF, JPG, PNG veya WEBP dosyaları yüklenebilir');
    const storedName = `${crypto.randomBytes(16).toString('hex')}.bin`;
    await fs.writeFile(path.join(PRIVATE_UPLOADS, storedName), encryptBuffer(file.buffer), { mode: 0o600 });
    const rec = await prisma.clientFile.create({
      data: { clientId: id, originalName: sanitizeName(file.originalname), storedName, mimeType: mime, sizeBytes: file.size, uploadedById: authUser(c).id },
      select: fileSelect,
    });
    await audit(c, 'clinical.file_uploaded', 'client', id, { fileId: rec.id, mime, size: file.size });
    return c.json({ file: rec }, 201);
  },
);

clientsRouter.get('/:id/files/:fileId/download', clinicalRead, async (c) => {
  const id = idParam(c);
  const fileId = idParam(c, 'fileId');
  const f = await prisma.clientFile.findFirst({ where: { id: fileId, clientId: id } });
  if (!f) throw notFound('Dosya bulunamadı');
  let buf: Buffer;
  try {
    buf = decryptBuffer(await fs.readFile(path.join(PRIVATE_UPLOADS, path.basename(f.storedName))));
  } catch {
    throw notFound('Dosya içeriği okunamadı');
  }
  await audit(c, 'clinical.file_downloaded', 'client', id, { fileId });
  const ascii = f.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return sendBuffer(c, buf, {
    'Content-Type': f.mimeType,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.originalName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
});

clientsRouter.delete('/:id/files/:fileId', clinicalWrite, async (c) => {
  const id = idParam(c);
  const fileId = idParam(c, 'fileId');
  const f = await prisma.clientFile.findFirst({ where: { id: fileId, clientId: id } });
  if (!f) throw notFound('Dosya bulunamadı');
  await prisma.clientFile.delete({ where: { id: f.id } });
  await fs.rm(path.join(PRIVATE_UPLOADS, path.basename(f.storedName)), { force: true });
  await audit(c, 'clinical.file_deleted', 'client', id, { fileId });
  return c.json({ ok: true });
});

// ───────────────────────── KVKK: veri dışa aktarma ─────────────────────────

const exportQuery = z.object({ includeClinical: z.enum(['0', '1']).optional() });

clientsRouter.get('/:id/export', canRead, async (c) => {
  const id = idParam(c);
  parse(exportQuery, query(c));
  const client = await getClientOr404(id);
  const clinical = authUser(c).permissions.includes('clinical:read');
  const [appointments, notes, measurements, files, recipes, plans, messages, account] = await Promise.all([
    prisma.appointment.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, status: true, startsAt: true, endsAt: true, meetingType: true, source: true, clientMessage: true,
        kvkkNoticeAcceptedAt: true, explicitConsentAt: true, createdAt: true, service: { select: { title: true } },
      },
    }),
    clinical ? prisma.consultationNote.findMany({ where: { clientId: id }, orderBy: { createdAt: 'asc' }, include: noteInclude }) : [],
    clinical ? prisma.measurement.findMany({ where: { clientId: id }, orderBy: { measuredOn: 'asc' } }) : [],
    prisma.clientFile.findMany({ where: { clientId: id }, select: { originalName: true, mimeType: true, sizeBytes: true, createdAt: true, visibleToClient: true } }),
    // Kişiye özel tarif varyasyonları (tarifler planlarla aynı klinik yetkiye bağlıdır)
    clinical
      ? prisma.recipe.findMany({ where: { clientId: id }, orderBy: { createdAt: 'asc' }, include: { parent: { select: { contentEnc: true } } } })
      : [],
    // Beslenme planları (şifreli saklanır; klinik yetki gerekir)
    clinical ? prisma.nutritionPlan.findMany({ where: { clientId: id }, orderBy: { createdAt: 'asc' } }) : [],
    // Danışana yazılan mesajlar (danışan zaten görür, ama içerik klinik bağlamlı olabilir)
    clinical ? prisma.clientMessage.findMany({ where: { clientId: id }, orderBy: { createdAt: 'asc' } }) : [],
    prisma.clientAccount.findUnique({ where: { clientId: id }, select: { email: true, isActive: true, activatedAt: true, lastLoginAt: true, createdAt: true } }),
  ]);
  // Grup dersleri (pilates): üyelikler ve katılım geçmişi (diğer katılımcıların bilgisi dahil edilmez)
  const [classGroups, classAttendances] = await Promise.all([
    prisma.classGroupMember.findMany({ where: { clientId: id }, select: { createdAt: true, group: { select: { name: true } } } }),
    prisma.classAttendance.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'asc' },
      select: { status: true, session: { select: { title: true, startsAt: true, endsAt: true, status: true } } },
    }),
  ]);
  // Planlardaki tarif bağlantılarını okunur hâle getir (tarif adı; silinmiş tarif null)
  const decodedPlans = plans.map((p) => ({ plan: p, data: decodePlan(p.dataEnc) }));
  const recipeIds = [...new Set(decodedPlans.flatMap((p) => p.data.recipes?.items.map((i) => i.recipeId) ?? []))];
  const recipeTitles = new Map(
    recipeIds.length ? (await prisma.recipe.findMany({ where: { id: { in: recipeIds } }, select: { id: true, contentEnc: true } })).map((r) => [r.id, decryptContent(r.contentEnc).title]) : [],
  );
  const payload = {
    exportedAt: new Date().toISOString(),
    notice: 'Bu dosya 6698 sayılı KVKK md. 11 kapsamındaki bilgi talebi için hazırlanmıştır. Yetkisiz kişilerle paylaşmayın.',
    clinicalDataIncluded: clinical,
    client,
    appointments,
    consultationNotes: notes.map(serializeNote),
    measurements: measurements.map(serializeMeasurement),
    files,
    clientAccount: account,
    classGroups: classGroups.map((m) => ({ group: m.group.name, joinedAt: m.createdAt })),
    classAttendances: classAttendances.map((a) => ({ ...a.session, attendance: a.status })),
    messagesToClient: messages.map((m) => {
      let content = '';
      try {
        content = decryptString(m.contentEnc);
      } catch {
        content = '[Çözülemedi]';
      }
      return { createdAt: m.createdAt, updatedAt: m.updatedAt, content };
    }),
    nutritionPlans: decodedPlans.map(({ plan, data }) => {
      const { recipes: attached, ...content } = data;
      return {
        name: plan.name,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        content,
        attachedRecipes: (attached?.items ?? []).map((i) => ({ title: recipeTitles.get(i.recipeId) ?? null, label: i.label })),
      };
    }),
    personalRecipes: recipes.map((r) => {
      const c = decryptContent(r.contentEnc);
      return {
      title: c.title,
      category: r.category,
      basedOn: r.parent ? decryptContent(r.parent.contentEnc).title : null,
      variantNote: decryptNote(r.variantNoteEnc),
      summary: c.summary,
      dietTags: c.dietTags,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      kcalPerServing: r.kcal,
      ingredients: c.ingredients,
      steps: c.steps,
      tip: c.tip,
      imageUrl: r.imageBase ? recipeImageUrl(r.imageBase, 960) : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      };
    }),
  };
  await audit(c, 'client.exported', 'client', id, { clinical, nutritionPlans: plans.length, personalRecipes: recipes.length });
  return c.body(JSON.stringify(payload, null, 2), 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="danisan-verileri-${client.id}.json"`,
    'Cache-Control': 'no-store',
  });
});
