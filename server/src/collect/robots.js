import { safeFetch } from './safeFetch.js';

const BOT_TOKEN = 'gendigitaltwinbot';

function patternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Avalia regras de robots.txt (RFC 9309): grupo do nosso robô ou "*", vence a regra mais longa. */
export function isPathAllowed(robotsTxt, path) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      if (value) current.rules.push({ allow: field === 'allow', pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT_TOKEN.includes(a)));
  const rules = (ours.length ? ours : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
  let best = null;
  for (const rule of rules) {
    if (!patternToRegex(rule.pattern).test(path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

async function fetchRobots(origin) {
  const res = await safeFetch(new URL('/robots.txt', origin), { maxBytes: 500_000, timeoutMs: 5_000, accept: 'text/plain' });
  if (res.status >= 500) return null; // servidor indisponível: por segurança, nada é permitido
  if (res.status >= 400) return ''; // sem robots.txt: tudo é permitido
  return res.body;
}

/** `cache` (origem -> conteúdo) evita baixar o robots.txt de novo para cada página do mesmo site. */
export async function isAllowedByRobots(url, cache = new Map()) {
  if (!cache.has(url.origin)) cache.set(url.origin, fetchRobots(url.origin));
  const robots = await cache.get(url.origin);
  return robots !== null && isPathAllowed(robots, url.pathname + url.search);
}
