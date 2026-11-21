// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme planları (/api/plans) — klinik veri: clinical:read / clinical:write gerekir.
 * İçerik şifreli saklanır; yazdırma sayfası istek anında üretilir, diske yazılmaz.
 */
import { z } from 'zod';
import { prisma } from '../lib/db';
import { decryptJson, encryptJson } from '../lib/crypto';
import { body, notFound, param, parse, query, router } from '../lib/http';
import { audit } from '../lib/audit';
import { authUser, requirePermission } from '../auth/session';
import { getSettings } from '../services/settings';
import { renderPlanPrintPage } from '../services/print';
import { emptyPlan, nutritionPlanDataSchema, planCreateSchema, planTitleFor, planUpdateSchema, type NutritionPlanData } from '../../shared/plan';
import { resolvePlanRecipes } from './recipes';
import { pushToClient } from '../services/push';

export const plansRouter = router();
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

export function decodePlan(enc: string): NutritionPlanData {
  const raw = decryptJson<unknown>(enc);
  const res = nutritionPlanDataSchema.safeParse(raw);
  return res.success ? res.data : (raw as NutritionPlanData);
}

async function load(id: string) {
  const plan = await prisma.nutritionPlan.findUnique({ where: { id }, include: { client: { select: { id: true, firstName: true, lastName: true } } } });
  if (!plan) throw notFound('Plan bulunamadı');
  return plan;
}

plansRouter.get('/', read, async (c) => {
  const q = parse(
    z.object({ clientId: z.string().max(40).optional(), templates: z.enum(['1', '0']).optional(), q: z.string().trim().max(80).optional() }),
    query(c),
  );
  const items = await prisma.nutritionPlan.findMany({
    where: {
      ...(q.clientId ? { clientId: q.clientId } : {}),
      ...(q.templates === '1' ? { isTemplate: true } : q.templates === '0' ? { isTemplate: false } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q } },
              { client: { firstName: { contains: q.q } } },
              { client: { lastName: { contains: q.q } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: listItem,
  });
  return c.json({ items });
});

plansRouter.get('/:id', read, async (c) => {
  const plan = await load(param(c));
  await audit(c, 'clinical.read', 'nutrition_plan', plan.id);
  const { dataEnc, ...rest } = plan;
  return c.json({ plan: { ...rest, data: decodePlan(dataEnc) } });
});

plansRouter.post('/', write, async (c) => {
  const input = parse(planCreateSchema, await body(c));
  const client = input.clientId ? await prisma.client.findUnique({ where: { id: input.clientId } }) : null;
  if (input.clientId && !client) throw notFound('Danışan bulunamadı');

  let data: NutritionPlanData;
  if (input.data) data = input.data;
  else if (input.fromId) {
    const src = await load(input.fromId);
    data = decodePlan(src.dataEnc);
  } else data = emptyPlan(await defaultSignature());
  if (client) data = { ...data, title: planTitleFor(client.firstName) };
  const sig = await defaultSignature();
  const { business } = await getSettings(['business']);
  // Boş ya da telefonsuz varsayılan imza ("Dyt. Nida Akın") → iletişim ayarlarındaki telefonla güncel imza
  if (!data.signature || data.signature === `Dyt. ${business.brandName}`) data.signature = sig;

  const plan = await prisma.nutritionPlan.create({
    data: {
      clientId: client?.id ?? null,
      isTemplate: client ? false : input.isTemplate,
      name: input.name,
      dataEnc: encryptJson(data),
      createdById: authUser(c).id,
    },
    select: listItem,
  });
  await audit(c, 'plan.created', 'nutrition_plan', plan.id, { fromTemplate: !!input.fromId, template: plan.isTemplate });
  // Danışana atanan liste Hesabım'da hemen görünür → mobil bildirim (liste adı/içeriği gönderilmez)
  if (client) pushToClient(client.id, { title: 'Yeni beslenme listen hazır', body: 'Hesabım’dan görüntüleyebilirsin.', url: `/hesabim/listeler/${plan.id}`, data: { type: 'PLAN_SHARED' } });
  return c.json({ plan }, 201);
});

plansRouter.patch('/:id', write, async (c) => {
  const input = parse(planUpdateSchema, await body(c));
  const plan = await load(param(c));
  const updated = await prisma.nutritionPlan.update({
    where: { id: plan.id },
    data: { ...(input.name ? { name: input.name } : {}), ...(input.data ? { dataEnc: encryptJson(input.data) } : {}) },
    select: listItem,
  });
  await audit(c, 'plan.updated', 'nutrition_plan', plan.id);
  return c.json({ plan: updated });
});

plansRouter.delete('/:id', write, async (c) => {
  const plan = await load(param(c));
  await prisma.nutritionPlan.delete({ where: { id: plan.id } });
  await audit(c, 'plan.deleted', 'nutrition_plan', plan.id);
  return c.json({ ok: true });
});

/** Yazdırma sayfası (A4). Tarayıcının yazdırma penceresinden "PDF olarak kaydet" ile PDF alınır. */
plansRouter.get('/:id/print', read, async (c) => {
  const plan = await load(param(c));
  const data = decodePlan(plan.dataEnc);
  const page = renderPlanPrintPage(data, data.title, await resolvePlanRecipes(data), { autoPrint: c.req.query('autoprint') === '1' });
  await audit(c, 'plan.print_opened', 'nutrition_plan', plan.id, { recipes: data.recipes.items.length });
  return c.html(page.html, 200, { 'Content-Security-Policy': page.csp, 'Cache-Control': 'no-store' });
});
