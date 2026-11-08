// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme planları (/api/plans) — klinik veri: clinical:read / clinical:write gerekir.
 * İçerik şifreli saklanır; PDF sunucuda üretilir ve diske yazılmaz.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { decryptJson, encryptJson } from '../lib/crypto';
import { HttpError, notFound, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { requirePermission } from '../auth/session';
import { getSettings } from '../services/settings';
import { PdfUnavailableError, renderPlanPdf } from '../services/pdf';
import { emptyPlan, nutritionPlanDataSchema, planCreateSchema, planTitleFor, planUpdateSchema, type NutritionPlanData } from '../../shared/plan';
import { slugify } from '../../shared/text';
import { resolvePlanRecipes } from './recipes';
import { todayStr } from '../../shared/time';

export const plansRouter = Router();
const read = requirePermission('clinical:read');
const write = requirePermission('clinical:write');

const listItem = {
  id: true, name: true, isTemplate: true, clientId: true, createdAt: true, updatedAt: true,
  client: { select: { id: true, firstName: true, lastName: true } },
} as const;

async function defaultSignature() {
  const { contact, business } = await getSettings(['contact', 'business']);
  const m = contact.phone?.match(/^\+90(5\d{2})(\d{3})(\d{2})(\d{2})$/);
  const phone = m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : contact.phone;
  return [`Dyt. ${business.brandName}`, phone].filter(Boolean).join(', ');
}

function decode(enc: string): NutritionPlanData {
  const raw = decryptJson<unknown>(enc);
  const res = nutritionPlanDataSchema.safeParse(raw);
  return res.success ? res.data : (raw as NutritionPlanData);
}

async function load(id: string) {
  const plan = await prisma.nutritionPlan.findUnique({ where: { id }, include: { client: { select: { id: true, firstName: true, lastName: true } } } });
  if (!plan) throw notFound('Plan bulunamadı');
  return plan;
}

plansRouter.get('/', read, async (req, res) => {
  const q = parse(
    z.object({ clientId: z.string().max(40).optional(), templates: z.enum(['1', '0']).optional(), q: z.string().trim().max(80).optional() }),
    req.query,
  );
  const items = await prisma.nutritionPlan.findMany({
    where: {
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...(q.templates === '1' ? { isTemplate: true } : q.templates === '0' ? { isTemplate: false } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' as const } },
              { client: { firstName: { contains: q.q, mode: 'insensitive' as const } } },
              { client: { lastName: { contains: q.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: listItem,
  });
  res.json({ items });
});

plansRouter.get('/:id', read, async (req, res) => {
  const plan = await load(String(req.params.id));
  await audit(req, 'clinical.read', 'nutrition_plan', plan.id);
  const { dataEnc, ...rest } = plan;
  res.json({ plan: { ...rest, data: decode(dataEnc) } });
});

plansRouter.post('/', write, async (req, res) => {
  const body = parse(planCreateSchema, req.body);
  const client = body.clientId ? await prisma.client.findUnique({ where: { id: body.clientId } }) : null;
  if (body.clientId && !client) throw notFound('Danışan bulunamadı');

  let data: NutritionPlanData;
  if (body.data) data = body.data;
  else if (body.fromId) {
    const src = await load(body.fromId);
    data = decode(src.dataEnc);
  } else data = emptyPlan(await defaultSignature());
  if (client) data = { ...data, title: planTitleFor(client.firstName) };
  const sig = await defaultSignature();
  const { business } = await getSettings(['business']);
  // Boş ya da telefonsuz varsayılan imza ("Dyt. Nida Akın") → iletişim ayarlarındaki telefonla güncel imza
  if (!data.signature || data.signature === `Dyt. ${business.brandName}`) data.signature = sig;

  const plan = await prisma.nutritionPlan.create({
    data: {
      clientId: client?.id ?? null,
      isTemplate: client ? false : body.isTemplate,
      name: body.name,
      dataEnc: encryptJson(data),
      createdById: req.user!.id,
    },
    select: listItem,
  });
  await audit(req, 'plan.created', 'nutrition_plan', plan.id, { fromTemplate: !!body.fromId, template: plan.isTemplate });
  res.status(201).json({ plan });
});

plansRouter.patch('/:id', write, async (req, res) => {
  const body = parse(planUpdateSchema, req.body);
  const plan = await load(String(req.params.id));
  const updated = await prisma.nutritionPlan.update({
    where: { id: plan.id },
    data: { ...(body.name ? { name: body.name } : {}), ...(body.data ? { dataEnc: encryptJson(body.data) } : {}) },
    select: listItem,
  });
  await audit(req, 'plan.updated', 'nutrition_plan', plan.id);
  res.json({ plan: updated });
});

plansRouter.delete('/:id', write, async (req, res) => {
  const plan = await load(String(req.params.id));
  await prisma.nutritionPlan.delete({ where: { id: plan.id } });
  await audit(req, 'plan.deleted', 'nutrition_plan', plan.id);
  res.json({ ok: true });
});

plansRouter.get('/:id/pdf', read, async (req, res) => {
  const plan = await load(String(req.params.id));
  const data = decode(plan.dataEnc);
  let out;
  try {
    out = await renderPlanPdf(data, data.title, await resolvePlanRecipes(data));
  } catch (e) {
    if (e instanceof PdfUnavailableError) throw new HttpError(503, 'PDF_UNAVAILABLE', e.message);
    throw e;
  }
  await audit(req, 'plan.pdf_generated', 'nutrition_plan', plan.id, { scale: out.scale, fits: out.fits, pages: out.pages, recipes: data.recipes.items.length });
  const who = plan.client ? `${plan.client.firstName}-${plan.client.lastName}` : plan.name;
  const file = `Beslenme-Plani-${slugify(who) || 'plan'}-${todayStr()}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${req.query.inline === '1' ? 'inline' : 'attachment'}; filename="${file}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Plan-Scale': String(out.scale),
    'X-Plan-Fits': String(out.fits),
    'X-Plan-Pages': String(out.pages),
    'X-Plan-Recipes-Fit': String(out.recipesFit),
  });
  res.send(Buffer.from(out.pdf));
});
