import { config } from '../config.js';
import { PermanentError } from './errors.js';

const RESERVED = new Set(['orgs', 'topics', 'features', 'about', 'pricing', 'login', 'settings', 'explore', 'marketplace']);

export function githubUsername(url) {
  const user = url.pathname.split('/').filter(Boolean)[0];
  return user && !RESERVED.has(user.toLowerCase()) && /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user) ? user : null;
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': config.userAgent,
      ...(config.githubToken && { Authorization: `Bearer ${config.githubToken}` }),
    },
  });
  if (res.status === 404) throw new PermanentError('Perfil do GitHub não encontrado');
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  return res.json();
}

/** Coleta perfil público e repositórios próprios (sem forks) pela API oficial. */
export async function collectGithub(username) {
  const [profile, repos] = await Promise.all([
    gh(`/users/${username}`),
    gh(`/users/${username}/repos?per_page=100&sort=updated&type=owner`),
  ]);
  return {
    profile: {
      login: profile.login, name: profile.name, bio: profile.bio, company: profile.company,
      location: profile.location, blog: profile.blog, htmlUrl: profile.html_url,
    },
    repos: repos.filter((r) => !r.fork).map((r) => ({
      name: r.name, description: r.description, language: r.language, topics: r.topics ?? [], pushedAt: r.pushed_at,
    })),
  };
}
