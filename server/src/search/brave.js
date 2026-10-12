import { config } from '../config.js';
import { PermanentError } from '../collect/errors.js';
import { decodeEntities } from '../collect/html.js';

const strip = (s) => (s ? decodeEntities(s.replace(/<[^>]+>/g, '')).trim() : null);

/** Brave Search API: https://api.search.brave.com/app/documentation/web-search */
export const braveSearch = {
  name: 'brave',
  available: () => Boolean(config.braveSearchApiKey),
  async search(query, { count = 10 } = {}) {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.search = new URLSearchParams({ q: query, count: String(count), country: 'BR', search_lang: 'pt-br', safesearch: 'strict' });
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json', 'X-Subscription-Token': config.braveSearchApiKey },
    });
    if (res.status === 401 || res.status === 403) throw new PermanentError('Chave da Brave Search inválida');
    if (res.status === 422) throw new PermanentError('Consulta recusada pelo buscador');
    if (!res.ok) throw new Error(`Brave Search respondeu ${res.status}`);
    const data = await res.json();
    return (data.web?.results ?? []).map((r) => ({ url: r.url, title: strip(r.title), snippet: strip(r.description) }));
  },
};
