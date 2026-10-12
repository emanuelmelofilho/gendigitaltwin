import { PermanentError } from './errors.js';
import { collectGithub, githubUsername } from './github.js';
import { parseHtml } from './html.js';
import { internalCandidates, profileCandidates } from './links.js';
import { isAllowedByRobots } from './robots.js';
import { safeFetch } from './safeFetch.js';

const MAX_INTERNAL_PAGES = 4;
const MAX_PROFILE_SUGGESTIONS = 6;

async function fetchPage(url, robotsCache) {
  if (!(await isAllowedByRobots(url, robotsCache))) {
    throw new PermanentError('O robots.txt do site não permite a coleta desta página');
  }
  const res = await safeFetch(url);
  if (res.status >= 400) {
    const message = `A página respondeu com erro ${res.status}`;
    throw res.status >= 500 ? new Error(message) : new PermanentError(message);
  }
  const type = res.contentType.split(';')[0].trim().toLowerCase();
  if (type === 'text/html' || type === 'application/xhtml+xml') return { url: res.url.href, ...parseHtml(res.body, res.url) };
  if (type === 'text/plain' || type === 'text/markdown') {
    return { url: res.url.href, title: null, description: null, text: res.body.slice(0, 100_000), links: [] };
  }
  throw new PermanentError(`Formato não suportado (${type || 'desconhecido'}). Por enquanto, apenas páginas HTML e texto.`);
}

/**
 * Coleta uma fonte autorizada pela pessoa. Em páginas, também lê até MAX_INTERNAL_PAGES páginas
 * do mesmo site (sobre, projetos, currículo...) e devolve perfis externos como sugestões.
 * @returns {Promise<{ kind: string, title: string|null, pages: object[], github?: object, suggestions: { url: string, text: string|null }[] }>}
 */
export async function collectSource(source) {
  const url = new URL(source.url);

  if (source.kind === 'github') {
    const username = githubUsername(url);
    if (!username) throw new PermanentError('Informe o link do perfil, por exemplo https://github.com/usuario');
    const github = await collectGithub(username);
    const blog = github.profile.blog?.trim();
    const blogUrl = blog ? (/^https?:\/\//i.test(blog) ? blog : `https://${blog}`) : null;
    return {
      kind: 'github',
      title: `GitHub de ${github.profile.name ?? github.profile.login}`,
      github,
      pages: [{ url: github.profile.htmlUrl }],
      suggestions: blogUrl ? [{ url: blogUrl, text: 'Site indicado no perfil do GitHub' }] : [],
    };
  }

  const robotsCache = new Map();
  const main = await fetchPage(url, robotsCache);
  const pages = [main];
  // Páginas internas são complementares: uma falha nelas não invalida a coleta.
  for (const internal of internalCandidates(main.links, main.url, MAX_INTERNAL_PAGES)) {
    try {
      pages.push(await fetchPage(new URL(internal), robotsCache));
    } catch (err) {
      console.warn(`página interna ignorada (${internal}): ${err.message}`);
    }
  }
  const suggestions = profileCandidates(pages.flatMap((p) => p.links), main.url, MAX_PROFILE_SUGGESTIONS);
  return { kind: 'pagina', title: main.title, pages, suggestions };
}
