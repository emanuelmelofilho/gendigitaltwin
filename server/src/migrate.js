import { readdir, readFile } from 'node:fs/promises';
import { pool, tx } from './db.js';

const dir = new URL('../migrations/', import.meta.url);

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`);
const { rows } = await pool.query('SELECT name FROM schema_migrations');
const applied = new Set(rows.map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(new URL(file, dir), 'utf8');
  await tx(async (db) => {
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
  });
  console.log(`aplicada: ${file}`);
}
console.log('migrações em dia');
await pool.end();
