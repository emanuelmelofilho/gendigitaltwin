import pg from 'pg';
import { config } from './config.js';

// numeric -> number; date -> 'YYYY-MM-DD' (sem conversão de fuso)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const toCamel = (key) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function camelize(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v]));
}
