import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { z } from 'zod';
import { config } from './config.js';
import { camelize, query, tx } from './db.js';
import { HttpError, parse } from './http.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'sid';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), userId, config.sessionDays],
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: config.sessionDays * 86_400_000,
    path: '/',
  });
}

async function loadPerson(userId) {
  const { rows } = await query('SELECT * FROM persons WHERE user_id = $1', [userId]);
  const { userId: _, ...person } = camelize(rows[0]);
  return person;
}

export async function requireAuth(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!token) return next(new HttpError(401, 'Faça login para continuar'));
  const { rows } = await query(
    `SELECT u.id, u.email, p.id AS person_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN persons p ON p.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  if (!rows[0]) return next(new HttpError(401, 'Sessão expirada'));
  req.user = { id: rows[0].id, email: rows[0].email };
  req.personId = rows[0].person_id;
  next();
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, password, name } = parse(credentials.extend({ name: z.string().trim().min(1).max(120) }), req.body);
  const passwordHash = await hashPassword(password);
  const userId = await tx(async (db) => {
    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rowCount) throw new HttpError(409, 'Este e-mail já está cadastrado');
    const { rows } = await db.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, passwordHash]);
    await db.query('INSERT INTO persons (user_id, name) VALUES ($1, $2)', [rows[0].id, name]);
    return rows[0].id;
  });
  await startSession(res, userId);
  res.status(201).json({ user: { id: userId, email }, person: await loadPerson(userId) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = parse(credentials, req.body);
  const { rows } = await query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
    throw new HttpError(401, 'E-mail ou senha incorretos');
  }
  await startSession(res, rows[0].id);
  res.json({ user: { id: rows[0].id, email }, person: await loadPerson(rows[0].id) });
});

authRouter.post('/logout', async (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user, person: await loadPerson(req.user.id) });
});
