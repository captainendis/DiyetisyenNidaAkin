// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tek seferlik veri taşıma: eski PostgreSQL kurulumundaki tüm veriyi yeni MySQL/MariaDB veritabanına kopyalar.
 *
 *   SOURCE_DATABASE_URL=postgresql://kullanici:sifre@sunucu:5432/nidaakin npm run data:migrate-pg
 *
 * - Hedef (DATABASE_URL, .env) önceden `npm run db:deploy` ile oluşturulmuş olmalı ve BOŞ olmalıdır
 *   (seed/yönetici oluşturma ÇALIŞTIRILMAMALI). Boş değilse betik durur; `--force` hedef tabloları boşaltıp yeniden doldurur.
 * - Kaynak, PostgreSQL sürümünün son migration'ında (20261109000000_client_portal) olmalıdır.
 * - Şifreli alanlar (planlar, notlar, ölçümler, tarifler, mesajlar) olduğu gibi kopyalanır: aynı DATA_ENCRYPTION_KEY
 *   kullanıldığı sürece çözülürler. Şifreli dosyalar (UPLOAD_DIR) veritabanında değildir; klasör ayrıca kopyalanır.
 * - Kaynakta hiçbir şey değiştirilmez.
 */
import pg from 'pg';
import mariadb from 'mariadb';

const LAST_PG_MIGRATION = '20261109000000_client_portal';

// Yabancı anahtar sırasına göre (önce bağımsız tablolar). FK denetimi taşıma süresince kapalı, sıra yine de korunur.
const TABLES = [
  'roles', 'users', 'sessions', 'password_reset_tokens',
  'clients', 'services', 'appointments', 'appointment_status_history',
  'availability_rules', 'blocked_dates',
  'notifications', 'notification_deliveries',
  'consultation_notes', 'measurements', 'client_files', 'nutrition_plans', 'recipes',
  'blog_categories', 'blog_posts', 'faqs', 'media_assets', 'website_settings', 'audit_logs',
  'client_accounts', 'client_account_tokens', 'client_sessions', 'client_messages',
] as const;

const BATCH = 200;

/** DATETIME(3) için UTC metni: 2026-11-14 08:03:32.123 */
const utc = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '');

function convert(v: unknown, mysqlType: string): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return utc(v);
  if (mysqlType === 'json' || mysqlType === 'longtext') {
    // jsonb nesneleri / text[] dizileri → JSON metni (MariaDB'de JSON, LONGTEXT takma adıdır)
    if (typeof v === 'object') return JSON.stringify(v);
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

async function main() {
  const source = process.env.SOURCE_DATABASE_URL;
  const target = process.env.DATABASE_URL;
  const force = process.argv.includes('--force');
  if (!source?.startsWith('postgres')) throw new Error('SOURCE_DATABASE_URL (postgresql://…) gerekli');
  if (!target?.startsWith('mysql') && !target?.startsWith('mariadb')) throw new Error('DATABASE_URL bir mysql:// adresi olmalı');

  const src = new pg.Client({ connectionString: source });
  await src.connect();
  const dst = await mariadb.createConnection(target.replace(/^mysql:/, 'mariadb:'));

  try {
    const mig = await src.query<{ migration_name: string }>(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1`,
    );
    if (mig.rows[0]?.migration_name !== LAST_PG_MIGRATION) {
      throw new Error(`Kaynak veritabanı güncel değil (son migration: ${mig.rows[0]?.migration_name ?? 'yok'}). Önce eski sürümde \`npm run db:deploy\` çalıştırın; beklenen: ${LAST_PG_MIGRATION}`);
    }

    const dbName = (await dst.query<{ db: string }[]>('SELECT DATABASE() AS db'))[0]!.db;
    const columnsOf = async (table: string) =>
      (await dst.query<{ name: string; type: string }[]>(
        `SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [dbName, table],
      ));

    // Hedef boş mu?
    const nonEmpty: string[] = [];
    for (const t of TABLES) {
      const n = Number((await dst.query<{ n: bigint }[]>(`SELECT COUNT(*) AS n FROM \`${t}\``))[0]!.n);
      if (n > 0) nonEmpty.push(`${t} (${n})`);
    }
    if (nonEmpty.length && !force) {
      throw new Error(`Hedef veritabanı boş değil: ${nonEmpty.join(', ')}.\nSeed/yönetici oluşturmadan taşıyın ya da hedefi boşaltmak için --force ekleyin.`);
    }

    await dst.query('SET FOREIGN_KEY_CHECKS = 0');
    await dst.beginTransaction();
    if (force) for (const t of [...TABLES].reverse()) await dst.query(`DELETE FROM \`${t}\``);

    for (const table of TABLES) {
      const cols = await columnsOf(table);
      if (!cols.length) throw new Error(`Hedefte ${table} tablosu yok — önce \`npm run db:deploy\``);
      const srcCols = new Set(
        (await src.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
          [table],
        )).rows.map((r) => r.column_name),
      );
      const missing = cols.filter((c) => !srcCols.has(c.name)).map((c) => c.name);
      if (missing.length) throw new Error(`${table}: kaynakta bulunmayan sütunlar: ${missing.join(', ')}`);

      const { rows } = await src.query(`SELECT ${cols.map((c) => `"${c.name}"`).join(', ')} FROM "${table}"`);
      const colList = cols.map((c) => `\`${c.name}\``).join(', ');
      const one = `(${cols.map(() => '?').join(', ')})`;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const values = chunk.flatMap((r) => cols.map((c) => convert(r[c.name], c.type)));
        await dst.query(`INSERT INTO \`${table}\` (${colList}) VALUES ${chunk.map(() => one).join(', ')}`, values);
      }
      console.log(`  ${table.padEnd(28)} ${rows.length}`);
    }

    await dst.commit();
    await dst.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Taşıma tamamlandı. Şimdi uygulamayı aynı DATA_ENCRYPTION_KEY ile açın ve storage/ klasörünü kopyalayın.');
  } catch (e) {
    await dst.rollback().catch(() => {});
    throw e;
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
