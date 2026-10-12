import { query } from './db.js';

export async function enqueue(db, type, payload) {
  await db.query('INSERT INTO jobs (type, payload) VALUES ($1, $2)', [type, JSON.stringify(payload)]);
}

/** Reserva o próximo job pronto; SKIP LOCKED permite vários workers em paralelo. */
export async function claimNext() {
  const { rows } = await query(
    `UPDATE jobs SET status = 'executando', attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM jobs WHERE status = 'pendente' AND run_after <= now()
         ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING *`,
  );
  return rows[0];
}

export async function complete(id) {
  await query(`UPDATE jobs SET status = 'concluido', last_error = NULL, updated_at = now() WHERE id = $1`, [id]);
}

/** Reagenda com espera crescente ou marca como falho. Retorna true se não haverá nova tentativa. */
export async function fail(job, error, { permanent = false } = {}) {
  const final = permanent || job.attempts >= job.max_attempts;
  await query(
    `UPDATE jobs SET status = $2, last_error = $3, updated_at = now(),
            run_after = now() + make_interval(secs => $4)
      WHERE id = $1`,
    [job.id, final ? 'falhou' : 'pendente', error.message, 15 * 2 ** job.attempts],
  );
  return final;
}

/** Jobs presos em "executando" (worker caiu no meio) voltam para a fila. */
export async function requeueStale() {
  await query(
    `UPDATE jobs SET status = 'pendente', updated_at = now()
      WHERE status = 'executando' AND updated_at < now() - interval '5 minutes'`,
  );
}
