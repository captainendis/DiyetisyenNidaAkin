/**
 * İlk kurulum verileri (idempotent — tekrar çalıştırmak mevcut içeriği EZMEZ).
 *  - Roller ve izinler
 *  - Haftalık çalışma kuralları: TÜM GÜNLER KAPALI. Gerçek çalışma saatleri panelden girilmelidir.
 *  - Site ayarları (shared/settings.ts varsayılanları)
 *  - Hizmet taslakları, blog kategorileri, taslak blog yazıları, SSS
 * Yönetici hesabı burada OLUŞTURULMAZ → `npm run admin:create`
 */
import { prisma } from '../server/lib/db';
import { ROLE_PERMISSIONS } from '../server/auth/permissions';
import { ROLE_LABEL, DEFAULT_BLOG_CATEGORIES } from '../shared/constants';
import { defaultSettings, SETTINGS_KEYS } from '../shared/settings';
import { seedFaqs, seedPosts, seedServices } from '../shared/seed-content';

async function main() {
  for (const key of ['ADMIN', 'DIETITIAN', 'ASSISTANT'] as const) {
    await prisma.role.upsert({
      where: { key },
      create: { key, name: ROLE_LABEL[key], permissions: ROLE_PERMISSIONS[key] },
      update: { name: ROLE_LABEL[key], permissions: ROLE_PERMISSIONS[key] },
    });
  }

  for (let weekday = 1; weekday <= 7; weekday++) {
    await prisma.availabilityRule.upsert({
      where: { weekday },
      create: { weekday, isWorking: false, slotMinutes: 45, bufferMinutes: 15 },
      update: {},
    });
  }

  for (const key of SETTINGS_KEYS) {
    await prisma.websiteSetting.upsert({ where: { key }, create: { key, value: defaultSettings[key] as never }, update: {} });
  }

  for (const [i, s] of seedServices.entries()) {
    await prisma.service.upsert({ where: { slug: s.slug }, create: { ...s, sortOrder: i }, update: {} });
  }

  for (const [i, c] of DEFAULT_BLOG_CATEGORIES.entries()) {
    await prisma.blogCategory.upsert({ where: { slug: c.slug }, create: { ...c, sortOrder: i }, update: { name: c.name } });
  }

  for (const p of seedPosts) {
    const { category, ...data } = p;
    const cat = await prisma.blogCategory.findUnique({ where: { slug: category } });
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      create: { ...data, categoryId: cat?.id, status: 'DRAFT', expertReviewed: false },
      update: {},
    });
  }

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({ data: seedFaqs.map((f, i) => ({ ...f, sortOrder: i })) });
  }

  console.log('✓ Temel veriler hazır. Yönetici hesabı için: npm run admin:create');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
