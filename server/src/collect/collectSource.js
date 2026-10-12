import { PermanentError } from './errors.js';
import { collectGithub, githubUsername } from './github.js';
import { parseHtml } from './html.js';
import { isAllowedByRobots } from './robots.js';
import { safeFetch } from './safeFetch.js';

/**
 * Coleta o conteúdo de uma fonte autorizada pela pessoa.
 * @returns {Promise<{ kind: 'github', title: string, github: object } | { kind: 'pagina', title: string|null, page: object }>}
 */
export async function collectSource(source) {
  const url = new URL(source.url);

  if (source.kind === 'github') {
    const username = githubUsername(url);
    if (!username) throw new PermanentError('Informe o link do perfil, por exemplo https://github.com/usuario');
    const github = await collectGithub(username);
    return { kind: 'github', title: `GitHub de ${github.profile.name ?? github.profile.login}`, github };
  }

  if (!(await isAllowedByRobots(url))) {
    throw new PermanentError('O robots.txt do site não permite a coleta desta página');
  }
  const res = await safeFetch(url);
  if (res.status >= 400) {
    const message = `A página respondeu com erro ${res.status}`;
    throw res.status >= 500 ? new Error(message) : new PermanentError(message);
  }
  const type = res.contentType.split(';')[0].trim().toLowerCase();
  let page;
  if (type === 'text/html' || type === 'application/xhtml+xml') {
    page = parseHtml(res.body);
  } else if (type === 'text/plain' || type === 'text/markdown') {
    page = { title: null, description: null, text: res.body.slice(0, 100_000) };
  } else {
    throw new PermanentError(`Formato não suportado (${type || 'desconhecido'}). Por enquanto, apenas páginas HTML e texto.`);
  }
  return { kind: 'pagina', title: page.title, page };
}
