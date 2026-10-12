// Classificação de links encontrados nas fontes: páginas internas que vale ler e perfis externos a sugerir.

const KEYWORDS = '(?:sobre|about|quem-sou|bio|perfil|profile|projetos?|projects?|portf[oó]lio|portfolio|trabalhos?|works?|curr[ií]culo|curriculum|cv|resume|r[eé]sum[eé]|experi[eê]ncia|experience|skills|habilidades|carreira|career)';
// Um trecho do caminho que COMEÇA com a palavra-chave (/sobre, /sobre-mim, /projects/); evita posts como /learning-about-x.
const RELEVANT_SEGMENT = new RegExp(`^${KEYWORDS}(?:[-_.].*)?$`, 'i');
// Texto curto de menu ("Sobre mim", "Meus projetos"), não títulos de posts.
const RELEVANT_TEXT = new RegExp(`^(?:\\S+\\s+)?${KEYWORDS}(?:\\s+\\S+)?$`, 'i');
const FILE_EXT = /\.(pdf|docx?|zip|png|jpe?g|gif|svg|webp|mp4|mp3|css|js|xml|json)$/i;

// Perfis que costumam pertencer à própria pessoa quando a página dela aponta para eles.
const PROFILE_PATTERNS = [
  /^github\.com\/[a-z\d-]+\/?$/i,
  /^gitlab\.com\/[\w.-]+\/?$/i,
  /^(?:www\.)?behance\.net\/[\w-]+\/?$/i,
  /^dribbble\.com\/[\w-]+\/?$/i,
  /^medium\.com\/@[\w.-]+\/?$/i,
  /^[\w-]+\.medium\.com\/?$/i,
  /^dev\.to\/[\w-]+\/?$/i,
  /^stackoverflow\.com\/users\/\d+/i,
  /^lattes\.cnpq\.br\/\d+/i,
  /^kaggle\.com\/[\w-]+\/?$/i,
];

// Sites que exigem login ou proíbem robôs: coletar falharia, então não sugerimos.
const BLOCKED_HOSTS = /(^|\.)(linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|threads\.net|youtube\.com|whatsapp\.com|t\.me)$/i;

const bareHost = (h) => h.toLowerCase().replace(/^www\./, '');

/** Identidade de um link sem esquema, www e barra final: http://www.a.dev/x/ == https://a.dev/x */
export function urlKey(url) {
  const u = new URL(url);
  return `${bareHost(u.hostname)}${u.pathname.replace(/\/+$/, '')}${u.search}`;
}

export function sourceKind(url) {
  return bareHost(new URL(url).hostname) === 'github.com' ? 'github' : 'pagina';
}

export function isBlockedHost(url) {
  return BLOCKED_HOSTS.test(bareHost(new URL(url).hostname));
}

/** Páginas do mesmo site com cara de "sobre", "projetos" ou "currículo". */
export function internalCandidates(links, pageUrl, max) {
  const base = new URL(pageUrl);
  const seen = new Set([urlKey(base.href)]);
  const result = [];
  for (const link of links) {
    const url = new URL(link.url);
    if (bareHost(url.hostname) !== bareHost(base.hostname) || FILE_EXT.test(url.pathname)) continue;
    url.search = '';
    const key = urlKey(url.href);
    if (seen.has(key)) continue;
    const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (!segments.some((seg) => RELEVANT_SEGMENT.test(seg)) && !RELEVANT_TEXT.test(link.text)) continue;
    seen.add(key);
    result.push(url.href);
    if (result.length >= max) break;
  }
  return result;
}

/** Perfis em outros sites apontados pela página (rel="me" ou padrões conhecidos de perfil). */
export function profileCandidates(links, pageUrl, max) {
  const base = bareHost(new URL(pageUrl).hostname);
  const seen = new Set();
  const result = [];
  for (const link of links) {
    const url = new URL(link.url);
    const host = bareHost(url.hostname);
    if (host === base || isBlockedHost(url.href)) continue;
    const path = `${host}${url.pathname}`;
    if (!link.rel.split(/\s+/).includes('me') && !PROFILE_PATTERNS.some((re) => re.test(path))) continue;
    url.search = '';
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    result.push({ url: url.href, text: link.text || null });
    if (result.length >= max) break;
  }
  return result;
}
