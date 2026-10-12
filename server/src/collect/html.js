const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function meta(html, name) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key === name) return decodeEntities(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').trim() || null;
  }
  return null;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3]).trim() : null;
}

/** Links da página, com endereço absoluto, texto e rel. */
export function parseLinks(html, baseUrl) {
  const links = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1], 'href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    url.hash = '';
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    links.push({ url: url.href, text: text.slice(0, 200), rel: (attr(m[1], 'rel') ?? '').toLowerCase() });
  }
  return links;
}

/** Extrai título, descrição, texto visível e links de uma página HTML. */
export function parseHtml(html, baseUrl) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(head|script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|br|li|h[1-6]|section|article|header|footer|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return {
    title: title ? decodeEntities(title).replace(/\s+/g, ' ').trim() : null,
    description: meta(html, 'description') ?? meta(html, 'og:description'),
    text: decodeEntities(text).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, 100_000),
    links: baseUrl ? parseLinks(html, baseUrl) : [],
  };
}
