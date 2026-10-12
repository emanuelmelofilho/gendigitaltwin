import { isBlockedHost, sourceKind, urlKey } from '../collect/links.js';

/**
 * Grava fontes descobertas pelo robô como "sugerida". Nada é coletado até a pessoa aprovar.
 * URLs que a pessoa já tem (inclusive descartadas, e variações http/www/barra final) são ignoradas.
 */
export async function insertSuggestions(db, personId, suggestions, { via, fromSourceId = null, searchId = null }) {
  const { rows } = await db.query('SELECT url FROM sources WHERE person_id = $1', [personId]);
  const known = new Set(rows.map((r) => urlKey(r.url)));
  let inserted = 0;
  for (const s of suggestions) {
    let url;
    try {
      url = new URL(s.url);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol) || isBlockedHost(url.href)) continue;
    url.hash = '';
    if (known.has(urlKey(url.href))) continue;
    known.add(urlKey(url.href));
    const { rowCount } = await db.query(
      `INSERT INTO sources (person_id, url, kind, status, discovered_via, discovered_from, search_id, title, snippet)
       VALUES ($1, $2, $3, 'sugerida', $4, $5, $6, $7, $8)
       ON CONFLICT (person_id, url) DO NOTHING`,
      [personId, url.href, sourceKind(url.href), via, fromSourceId, searchId, s.title ?? null, s.snippet ?? s.text ?? null],
    );
    inserted += rowCount;
  }
  return inserted;
}
