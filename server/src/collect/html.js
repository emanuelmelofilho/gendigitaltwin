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

/** Extrai título, descrição e texto visível de uma página HTML. */
export function parseHtml(html) {
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
  };
}
