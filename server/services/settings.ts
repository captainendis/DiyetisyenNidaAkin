// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** website_settings okuma/yazma — varsayılanlarla birleştirerek döner */
import { prisma } from '../lib/db';
import { defaultSettings, settingsSchemas, type Settings, type SettingsKey } from '../../shared/settings';

export async function getSettings<K extends SettingsKey>(keys: readonly K[]): Promise<Pick<Settings, K>> {
  const rows = await prisma.websiteSetting.findMany({ where: { key: { in: keys as unknown as string[] } } });
  const out = {} as Pick<Settings, K>;
  for (const k of keys) {
    const row = rows.find((r) => r.key === k);
    const parsed = row ? settingsSchemas[k].safeParse({ ...(defaultSettings[k] as object), ...(row.value as object) }) : null;
    out[k] = (parsed?.success ? parsed.data : defaultSettings[k]) as Settings[K];
  }
  return out;
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<Settings[K]> {
  return (await getSettings([key]))[key];
}

export async function saveSetting<K extends SettingsKey>(key: K, value: Settings[K], userId?: string) {
  await prisma.websiteSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedById: userId ?? null },
    update: { value: value as never, updatedById: userId ?? null },
  });
}
