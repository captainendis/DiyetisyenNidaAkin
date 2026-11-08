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
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma, type Prisma } from '../lib/db';
import { HttpError, badRequest, conflict, notFound, parse } from '../lib/http';
import { deleteClientRecipeImages } from './recipes';
import { audit } from '../lib/audit';
import { decryptBuffer, decryptJson, decryptString, encryptBuffer, encryptJson, encryptString } from '../lib/crypto';
import { PRIVATE_UPLOADS, sniffMime } from '../lib/storage';
import { requirePermission } from '../auth/session';
import { notifyStaff } from '../services/notifications';
import {
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  consultationNoteSchema,
  healthConsentSchema,
  measurementSchema,
} from '../../shared/schemas';

export const clientsRouter = Router();

const canRead = requirePermission('clients:read');
const canWrite = requirePermission('clients:write');
const canDelete = requirePermission('clients:delete');
const clinicalRead = requirePermission('clinical:read');
const clinicalWrite = requirePermission('clinical:write');

const VISIT_STATUSES = ['COMPLETED', 'CONFIRMED'] as const;

function idParam(req: Request, key = 'id') {
  const v = req.params[key];
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

clientsRouter.get('/', canRead, async (req, res) => {
  const q = parse(clientListQuerySchema, req.query);
  const where: Prisma.ClientWhereInput = {};
  if (q.status) where.status = q.status;
  else where.status = { not: 'ARCHIVED' };
  if (q.q) {
    const term = q.q.trim();
    const parts = term.split(/\s+/).filter(Boolean);
    const digits = term.replace(/\D/g, '');
    const or: Prisma.ClientWhereInput[] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term.toLowerCase(), mode: 'insensitive' } },
    ];
    // Türkçe büyük/küçük harf (İ/ı) için yerelleştirilmiş varyantlar
    const lower = term.toLocaleLowerCase('tr-TR');
    const upper = term.toLocaleUpperCase('tr-TR');
    for (const v of new Set([lower, upper, lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1)])) {
      if (v !== term) or.push({ firstName: { contains: v, mode: 'insensitive' } }, { lastName: { contains: v, mode: 'insensitive' } });
    }
    if (parts.length >= 2) {
      const first = parts.slice(0, -1).join(' ');
      const last = parts[parts.length - 1];
      or.push({ AND: [{ firstName: { contains: first, mode: 'insensitive' } }, { lastName: { contains: last, mode: 'insensitive' } }] });
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
  res.json({
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

clientsRouter.post('/', canWrite, async (req, res) => {
  const data = parse(clientCreateSchema, req.body);
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
  await audit(req, 'client.created', 'client', client.id);
  await notifyStaff('CLIENT_CREATED', { title: `Yeni danışan kaydı: ${client.firstName} ${client.lastName}`, clientId: client.id });
  res.status(201).json({ client });
});

// ───────────────────────── Tekil kayıt ─────────────────────────

clientsRouter.get('/:id', canRead, async (req, res) => {
  const client = await getClientOr404(idParam(req));
  const s = (await visitStats([client.id])).get(client.id)!;
  const nextAppointment = await prisma.appointment.findFirst({
    where: { clientId: client.id, status: { in: ['CONFIRMED', 'PENDING'] }, startsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, startsAt: true, status: true },
  });
  res.json({
    client,
    stats: { totalVisits: s.totalVisits, lastVisitAt: s.lastVisitAt, nextAppointment, firstAppointmentAt: s.firstAppointmentAt },
  });
});

clientsRouter.patch('/:id', canWrite, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const data = parse(clientUpdateSchema, req.body);
  if (data.phone) {
    const dupe = await prisma.client.findFirst({ where: { phone: data.phone, id: { not: id } }, select: { id: true } });
    if (dupe) throw conflict('DUPLICATE_PHONE', 'Bu telefon numarası başka bir danışana kayıtlı', { existingClientId: dupe.id, fields: { phone: 'Bu numara başka bir danışana kayıtlı' } });
  }
  const client = await prisma.client.update({ where: { id }, data });
  await audit(req, 'client.updated', 'client', id, { fields: Object.keys(data) });
  res.json({ client });
});

clientsRouter.post('/:id/kvkk-notice', canWrite, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const client = await prisma.client.update({ where: { id }, data: { kvkkNoticeAt: new Date() } });
  await audit(req, 'client.kvkk_notice_recorded', 'client', id);
  res.json({ client });
});

/** KVKK kapsamında silme: klinik veriler ve dosyalar kalıcı silinir, randevu geçmişi anonimleştirilir. */
clientsRouter.delete('/:id', canDelete, async (req, res) => {
  const id = idParam(req);
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
  await audit(req, 'client.deleted', 'client', id, { filesRemoved: files.length, recipesRemoved });
  res.json({ ok: true });
});

clientsRouter.get('/:id/appointments', canRead, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const items = await prisma.appointment.findMany({
    where: { clientId: id },
    orderBy: [{ startsAt: { sort: 'desc', nulls: 'first' } }],
    select: {
      id: true, status: true, startsAt: true, endsAt: true, meetingType: true, source: true, createdAt: true,
      service: { select: { id: true, title: true } },
    },
  });
  res.json({ items });
});

// ───────────────────────── Açık rıza ─────────────────────────

clientsRouter.post('/:id/health-consent', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const { granted, note } = parse(healthConsentSchema, req.body);
  const client = await prisma.client.update({
    where: { id },
    data: granted
      ? { healthConsentAt: new Date(), healthConsentNote: note ?? null, healthConsentWithdrawnAt: null }
      : { healthConsentAt: null, healthConsentWithdrawnAt: new Date(), healthConsentNote: note ?? null },
  });
  await audit(req, granted ? 'client.health_consent_granted' : 'client.health_consent_withdrawn', 'client', id);
  res.json({ client });
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

clientsRouter.get('/:id/notes', clinicalRead, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const notes = await prisma.consultationNote.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, include: noteInclude });
  await audit(req, 'clinical.read', 'client', id, { resource: 'notes', count: notes.length });
  res.json({ items: notes.map(serializeNote) });
});

clientsRouter.post('/:id/notes', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const { content, appointmentId } = parse(consultationNoteSchema, req.body);
  if (appointmentId) {
    const a = await prisma.appointment.findFirst({ where: { id: appointmentId, clientId: id }, select: { id: true } });
    if (!a) throw badRequest('Seçilen randevu bu danışana ait değil');
  }
  const note = await prisma.consultationNote.create({
    data: { clientId: id, appointmentId: appointmentId ?? null, authorId: req.user!.id, contentEnc: encryptString(content) },
    include: noteInclude,
  });
  await audit(req, 'clinical.note_created', 'client', id, { noteId: note.id });
  res.status(201).json({ note: serializeNote(note) });
});

clientsRouter.patch('/:id/notes/:noteId', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  const noteId = idParam(req, 'noteId');
  const existing = await prisma.consultationNote.findFirst({ where: { id: noteId, clientId: id } });
  if (!existing) throw notFound('Not bulunamadı');
  const { content } = parse(consultationNoteSchema.pick({ content: true }), req.body);
  const note = await prisma.consultationNote.update({ where: { id: noteId }, data: { contentEnc: encryptString(content) }, include: noteInclude });
  await audit(req, 'clinical.note_updated', 'client', id, { noteId });
  res.json({ note: serializeNote(note) });
});

clientsRouter.delete('/:id/notes/:noteId', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  const noteId = idParam(req, 'noteId');
  const r = await prisma.consultationNote.deleteMany({ where: { id: noteId, clientId: id } });
  if (!r.count) throw notFound('Not bulunamadı');
  await audit(req, 'clinical.note_deleted', 'client', id, { noteId });
  res.json({ ok: true });
});

// ───────────────────────── Ölçümler ─────────────────────────

interface MeasurementData { heightCm?: number | null; weightKg?: number | null; targetWeightKg?: number | null; note?: string | null }

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
    note: d.note ?? null,
    bmi,
    createdAt: m.createdAt,
  };
}

clientsRouter.get('/:id/measurements', clinicalRead, async (req, res) => {
  const id = idParam(req);
  const client = await getClientOr404(id);
  const rows = await prisma.measurement.findMany({ where: { clientId: id }, orderBy: [{ measuredOn: 'desc' }, { createdAt: 'desc' }] });
  await audit(req, 'clinical.read', 'client', id, { resource: 'measurements', count: rows.length });
  res.json({ items: rows.map(serializeMeasurement), consent: !!client.healthConsentAt });
});

clientsRouter.post('/:id/measurements', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  requireConsent(await getClientOr404(id));
  const { measuredOn, ...data } = parse(measurementSchema, req.body);
  if (data.heightCm == null && data.weightKg == null && data.targetWeightKg == null && !data.note) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'En az bir ölçüm değeri girin', { fields: { weightKg: 'En az bir ölçüm değeri girin' } });
  }
  const m = await prisma.measurement.create({
    data: { clientId: id, measuredOn, dataEnc: encryptJson(data), createdById: req.user!.id },
  });
  await audit(req, 'clinical.measurement_created', 'client', id, { measurementId: m.id });
  res.status(201).json({ measurement: serializeMeasurement(m) });
});

clientsRouter.delete('/:id/measurements/:mid', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  const mid = idParam(req, 'mid');
  const r = await prisma.measurement.deleteMany({ where: { id: mid, clientId: id } });
  if (!r.count) throw notFound('Ölçüm bulunamadı');
  await audit(req, 'clinical.measurement_deleted', 'client', id, { measurementId: mid });
  res.json({ ok: true });
});

// ───────────────────────── Dosyalar ─────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const ALLOWED_FILE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function sanitizeName(name: string) {
  // multer latin1 olarak çözer; UTF-8'e geri çevir
  let n = name;
  try {
    n = Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    /* yoksay */
  }
  n = path.basename(n).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').trim();
  return (n || 'dosya').slice(0, 160);
}

const fileSelect = {
  id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true,
  uploadedBy: { select: { firstName: true, lastName: true } },
} as const;

clientsRouter.get('/:id/files', clinicalRead, async (req, res) => {
  const id = idParam(req);
  await getClientOr404(id);
  const items = await prisma.clientFile.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, select: fileSelect });
  res.json({ items });
});

clientsRouter.post(
  '/:id/files',
  clinicalWrite,
  (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        return next(err.code === 'LIMIT_FILE_SIZE' ? new HttpError(413, 'FILE_TOO_LARGE', 'Dosya en fazla 10 MB olabilir') : badRequest('Dosya yüklenemedi'));
      }
      next(err as Error | undefined);
    });
  },
  async (req, res) => {
    const id = idParam(req);
    requireConsent(await getClientOr404(id));
    const file = req.file;
    if (!file) throw badRequest('Dosya seçilmedi');
    const mime = sniffMime(file.buffer);
    if (!mime || !ALLOWED_FILE_MIME.has(mime)) throw new HttpError(415, 'UNSUPPORTED_FILE', 'Yalnızca PDF, JPG, PNG veya WEBP dosyaları yüklenebilir');
    const storedName = `${crypto.randomBytes(16).toString('hex')}.bin`;
    await fs.writeFile(path.join(PRIVATE_UPLOADS, storedName), encryptBuffer(file.buffer), { mode: 0o600 });
    const rec = await prisma.clientFile.create({
      data: { clientId: id, originalName: sanitizeName(file.originalname), storedName, mimeType: mime, sizeBytes: file.size, uploadedById: req.user!.id },
      select: fileSelect,
    });
    await audit(req, 'clinical.file_uploaded', 'client', id, { fileId: rec.id, mime, size: file.size });
    res.status(201).json({ file: rec });
  },
);

clientsRouter.get('/:id/files/:fileId/download', clinicalRead, async (req, res) => {
  const id = idParam(req);
  const fileId = idParam(req, 'fileId');
  const f = await prisma.clientFile.findFirst({ where: { id: fileId, clientId: id } });
  if (!f) throw notFound('Dosya bulunamadı');
  let buf: Buffer;
  try {
    buf = decryptBuffer(await fs.readFile(path.join(PRIVATE_UPLOADS, path.basename(f.storedName))));
  } catch {
    throw notFound('Dosya içeriği okunamadı');
  }
  await audit(req, 'clinical.file_downloaded', 'client', id, { fileId });
  const ascii = f.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.set({
    'Content-Type': f.mimeType,
    'Content-Length': String(buf.length),
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.originalName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(buf);
});

clientsRouter.delete('/:id/files/:fileId', clinicalWrite, async (req, res) => {
  const id = idParam(req);
  const fileId = idParam(req, 'fileId');
  const f = await prisma.clientFile.findFirst({ where: { id: fileId, clientId: id } });
  if (!f) throw notFound('Dosya bulunamadı');
  await prisma.clientFile.delete({ where: { id: f.id } });
  await fs.rm(path.join(PRIVATE_UPLOADS, path.basename(f.storedName)), { force: true });
  await audit(req, 'clinical.file_deleted', 'client', id, { fileId });
  res.json({ ok: true });
});

// ───────────────────────── KVKK: veri dışa aktarma ─────────────────────────

const exportQuery = z.object({ includeClinical: z.enum(['0', '1']).optional() });

clientsRouter.get('/:id/export', canRead, async (req, res) => {
  const id = idParam(req);
  parse(exportQuery, req.query);
  const client = await getClientOr404(id);
  const clinical = req.user!.permissions.includes('clinical:read');
  const [appointments, notes, measurements, files] = await Promise.all([
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
    prisma.clientFile.findMany({ where: { clientId: id }, select: { originalName: true, mimeType: true, sizeBytes: true, createdAt: true } }),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    notice: 'Bu dosya 6698 sayılı KVKK md. 11 kapsamındaki bilgi talebi için hazırlanmıştır. Yetkisiz kişilerle paylaşmayın.',
    clinicalDataIncluded: clinical,
    client,
    appointments,
    consultationNotes: notes.map(serializeNote),
    measurements: measurements.map(serializeMeasurement),
    files,
  };
  await audit(req, 'client.exported', 'client', id, { clinical });
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="danisan-verileri-${client.id}.json"`,
    'Cache-Control': 'no-store',
  });
  res.send(JSON.stringify(payload, null, 2));
});
