/**
 * DEMO VERİSİ — yalnızca tanıtım/geliştirme amaçlıdır.
 *
 *  Çalıştırma:   DEMO_MODE=true npm run db:seed:demo
 *  Temizleme:    DEMO_MODE=true npm run db:seed:demo -- --clean
 *
 * Güvenlik önlemleri:
 *  - DEMO_MODE=true değilse çalışmaz (gerçek kurulumda yanlışlıkla çalıştırılmasını önler).
 *  - Tüm demo danışanların e-postası "@demo.invalid" ile biter ve iç notlarında "Demo verisi" yazar;
 *    --clean bu kayıtları ve bağlı randevularını siler.
 *  - Demo çalışma saatleri yalnızca TÜM günler kapalıysa (yani gerçek saatler girilmemişse) yazılır.
 *  - Panelde DEMO_MODE=true iken "Demo modu açık" uyarısı görünür.
 */
import { DateTime } from 'luxon';
import { prisma } from '../server/lib/db';
import { encryptJson, encryptString } from '../server/lib/crypto';
import { TIME_ZONE, type AppointmentStatus } from '../shared/constants';

const DEMO_DOMAIN = 'demo.invalid';

const NAMES = [
  ['Ayşe', 'Yıldız'], ['Mehmet', 'Kaya'], ['Zeynep', 'Arslan'], ['Elif', 'Şahin'], ['Can', 'Demir'],
  ['Selin', 'Koç'], ['Burak', 'Aydın'], ['Deniz', 'Çelik'], ['Ece', 'Öztürk'], ['Murat', 'Polat'],
  ['Gizem', 'Erdoğan'], ['Emre', 'Yılmaz'], ['Defne', 'Aksoy'], ['Kerem', 'Güneş'], ['Buse', 'Tekin'],
  ['Onur', 'Kurt'], ['İrem', 'Özdemir'], ['Ozan', 'Bulut'],
];

// Deterministik sözde rastgele (her çalıştırmada aynı demo)
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;

async function clean() {
  const clients = await prisma.client.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  const ids = clients.map((c) => c.id);
  const del = await prisma.appointment.deleteMany({ where: { OR: [{ clientId: { in: ids } }, { contactEmail: { endsWith: `@${DEMO_DOMAIN}` } }] } });
  await prisma.notification.deleteMany({ where: { OR: [{ clientId: { in: ids } }, { title: { contains: '(demo)' } }] } });
  const cl = await prisma.client.deleteMany({ where: { id: { in: ids } } });
  console.log(`✓ Demo verisi temizlendi: ${cl.count} danışan, ${del.count} randevu`);
}

async function main() {
  if (process.env.DEMO_MODE !== 'true') {
    console.error('✖ Bu betik yalnızca DEMO_MODE=true iken çalışır. Gerçek kurulumda demo verisi kullanmayın.');
    process.exit(1);
  }
  if (process.argv.includes('--clean')) return clean();

  const existing = await prisma.client.count({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
  if (existing) {
    console.log('Demo verisi zaten var. Yeniden oluşturmak için önce --clean ile temizleyin.');
    return;
  }

  // Demo çalışma saatleri — yalnızca hiç çalışma günü tanımlanmamışsa
  const working = await prisma.availabilityRule.count({ where: { isWorking: true } });
  if (working === 0) {
    for (let d = 1; d <= 7; d++) {
      const weekday = d <= 5;
      const sat = d === 6;
      await prisma.availabilityRule.update({
        where: { weekday: d },
        data: {
          isWorking: weekday || sat,
          startTime: weekday ? '10:00' : sat ? '10:00' : null,
          endTime: weekday ? '18:00' : sat ? '14:00' : null,
          breakStart: weekday ? '12:45' : null,
          breakEnd: weekday ? '13:45' : null,
          slotMinutes: 45,
          bufferMinutes: 15,
        },
      });
    }
    console.log('• Demo çalışma saatleri yazıldı (Pzt–Cum 10:00–18:00, Cmt 10:00–14:00). Gerçek saatleri panelden girin.');
  }

  const services = await prisma.service.findMany({ orderBy: { sortOrder: 'asc' } });
  const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  const now = DateTime.now().setZone(TIME_ZONE);
  const clients = [];
  for (const [i, [firstName, lastName]] of NAMES.entries()) {
    const created = now.minus({ days: 75 - i * 3 });
    const c = await prisma.client.create({
      data: {
        firstName,
        lastName,
        phone: `+90555000${String(1000 + i).slice(-4)}`,
        email: `${firstName.toLocaleLowerCase('tr-TR').replace(/[^a-z]/g, '')}.${i}@${DEMO_DOMAIN}`,
        status: i % 7 === 6 ? 'PASSIVE' : 'ACTIVE',
        source: i % 3 === 0 ? 'WEBSITE' : 'PANEL',
        preferredMeetingType: i % 4 === 0 ? 'ONLINE' : 'IN_PERSON',
        firstVisitDate: created.toISODate(),
        internalNote: 'Demo verisi',
        kvkkNoticeAt: created.toJSDate(),
        healthConsentAt: i % 2 === 0 ? created.toJSDate() : null,
        createdAt: created.toJSDate(),
      },
    });
    clients.push(c);
  }

  // Slot üretimi: geçmiş 35 gün + gelecek 14 gün; çakışmasız
  const rules = await prisma.availabilityRule.findMany();
  let count = 0;
  for (let offset = -35; offset <= 14; offset++) {
    const day = now.plus({ days: offset }).startOf('day');
    const rule = rules.find((r) => r.weekday === day.weekday);
    if (!rule?.isWorking || !rule.startTime || !rule.endTime) continue;
    const [sh, sm] = rule.startTime.split(':').map(Number);
    const [eh, em] = rule.endTime.split(':').map(Number);
    for (let t = sh * 60 + sm; t + rule.slotMinutes <= eh * 60 + em; t += rule.slotMinutes + rule.bufferMinutes) {
      if (rule.breakStart && rule.breakEnd) {
        const [bs1, bs2] = rule.breakStart.split(':').map(Number);
        const [be1, be2] = rule.breakEnd.split(':').map(Number);
        if (t < be1 * 60 + be2 && t + rule.slotMinutes > bs1 * 60 + bs2) continue;
      }
      const fill = offset < 0 ? 0.55 : offset === 0 ? 0.7 : 0.4;
      if (rnd() > fill) continue;
      const start = day.plus({ minutes: t });
      const client = pick(clients);
      let status: AppointmentStatus;
      if (start < now) {
        const r = rnd();
        status = r < 0.78 ? 'COMPLETED' : r < 0.9 ? 'CANCELLED' : 'NO_SHOW';
      } else {
        status = rnd() < 0.7 ? 'CONFIRMED' : 'PENDING';
      }
      const service = pick(services);
      const createdAt = start.minus({ days: 2 + Math.floor(rnd() * 8) });
      await prisma.appointment.create({
        data: {
          clientId: client.id,
          serviceId: service?.id,
          contactName: `${client.firstName} ${client.lastName}`,
          contactPhone: client.phone,
          contactEmail: client.email,
          startsAt: start.toJSDate(),
          endsAt: start.plus({ minutes: rule.slotMinutes }).toJSDate(),
          meetingType: client.preferredMeetingType ?? 'IN_PERSON',
          status,
          source: client.source,
          kvkkNoticeAcceptedAt: createdAt.toJSDate(),
          createdById: client.source === 'PANEL' ? admin?.id : null,
          createdAt: createdAt.toJSDate(),
          statusHistory: { create: { toStatus: status, changedAt: createdAt.toJSDate(), note: 'Demo verisi' } },
        },
      });
      count++;
    }
  }

  // Saat seçmeden gelen iki "beni arayın" talebi
  for (const c of clients.slice(0, 2)) {
    await prisma.appointment.create({
      data: {
        clientId: null,
        contactName: `${c.firstName} ${c.lastName}`,
        contactPhone: c.phone,
        contactEmail: c.email,
        status: 'NEW_REQUEST',
        source: 'WEBSITE',
        meetingType: 'ONLINE',
        clientMessage: 'Hafta içi akşam saatleri benim için daha uygun. (demo)',
        kvkkNoticeAcceptedAt: new Date(),
        statusHistory: { create: { toStatus: 'NEW_REQUEST', note: 'Demo verisi' } },
      },
    });
  }

  // Örnek klinik kayıtlar (şifreli) — yalnızca açık rızası işaretli demo danışanlarda
  for (const c of clients.filter((x) => x.healthConsentAt).slice(0, 4)) {
    await prisma.consultationNote.create({
      data: { clientId: c.id, authorId: admin?.id, contentEnc: encryptString('Demo görüşme notu: Hedefler ve günlük öğün düzeni konuşuldu.') },
    });
    let w = 70 + Math.round(rnd() * 20);
    for (let k = 0; k < 4; k++) {
      await prisma.measurement.create({
        data: {
          clientId: c.id,
          measuredOn: now.minus({ days: 60 - k * 18 }).toISODate()!,
          dataEnc: encryptJson({ heightCm: 168, weightKg: w, targetWeightKg: 68, note: 'Demo ölçümü' }),
          createdById: admin?.id,
        },
      });
      w -= 1 + Math.round(rnd());
    }
  }

  // Demo modunda taslak blog yazılarını yayınla (gerçek kullanımda uzman onayıyla yayınlanmalı)
  await prisma.blogPost.updateMany({
    where: { status: 'DRAFT' },
    data: { status: 'PUBLISHED', expertReviewed: true, publishedAt: now.minus({ days: 3 }).toJSDate() },
  });

  if (admin) {
    const pending = await prisma.appointment.findFirst({ where: { status: 'PENDING' }, orderBy: { startsAt: 'asc' } });
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: 'APPOINTMENT_REQUESTED',
        title: `Yeni randevu talebi (demo): ${pending?.contactName ?? 'Danışan'}`,
        body: 'Web sitesinden gelen talep onay bekliyor.',
        appointmentId: pending?.id,
      },
    });
  }

  console.log(`✓ Demo verisi oluşturuldu: ${clients.length} danışan, ${count + 2} randevu.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
