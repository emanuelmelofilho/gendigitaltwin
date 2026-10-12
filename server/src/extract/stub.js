/**
 * Extrator sem IA: heurísticas simples sobre o conteúdo coletado. Cada achado aponta a
 * evidência (trecho) e uma confiança baixa, porque tudo passa pela revisão da pessoa.
 * Um extrator com IA deve implementar a mesma interface: extract({ source, collected }) -> Finding[].
 */

const SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'React Native', 'Node.js', 'Vue', 'Angular', 'Next.js', 'Svelte',
  'Python', 'Django', 'Flask', 'FastAPI', 'Java', 'Kotlin', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby on Rails',
  'Golang', 'Elixir', 'Scala', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'Docker',
  'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Terraform', 'Linux', 'Figma', 'Power BI', 'Tableau',
  'Scrum', 'Machine Learning', 'Data Science', 'Pandas', 'TensorFlow', 'PyTorch',
  // Palavras comuns em outros contextos: só contam com a grafia exata.
  { name: 'Go', caseSensitive: true }, { name: 'Rust', caseSensitive: true }, { name: 'Swift', caseSensitive: true },
  { name: 'Excel', caseSensitive: true }, { name: 'Spring', caseSensitive: true }, { name: 'Git', caseSensitive: true },
].map((s) => (typeof s === 'string' ? { name: s, caseSensitive: false } : s));

const PROFESSIONS = [
  /desenvolvedor(?:a)?(?: (?:front-?end|back-?end|full[- ]?stack|web|mobile|de software))?/i,
  /engenheir[oa] de (?:software|dados|computação|machine learning)/i,
  /cientista de dados/i,
  /analista de (?:sistemas|dados|negócios|BI)/i,
  /arquitet[oa] de (?:software|soluções)/i,
  /designer(?: de produto| UX| UI| gráfico)?/i,
  /(?:gerente|gestor[a]?) de (?:produto|projetos)/i,
  /(?:front-?end|back-?end|full[- ]?stack|software|mobile|devops|data|machine learning) (?:developer|engineer)/i,
  /data (?:scientist|analyst)/i,
  /product (?:manager|designer)/i,
  /tech lead/i,
  /professor(?:a)?(?: de [\wÀ-ú]+)?/i,
];

const MAX_FINDINGS = 25;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function snippet(text, index, length) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 80);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fromPage({ title, description, text }) {
  const findings = [];
  const header = [title, description].filter(Boolean).join(' — ');

  const professions = new Set();
  for (const [content, confidence] of [[header, 0.6], [text, 0.4]]) {
    for (const re of PROFESSIONS) {
      const m = content.match(re);
      if (!m || professions.has(m[0].toLowerCase())) continue;
      professions.add(m[0].toLowerCase());
      findings.push({ category: 'perfil', key: 'profissao', value: capitalize(m[0]), evidence: snippet(content, m.index, m[0].length), confidence });
    }
  }

  const full = `${header}\n${text}`;
  for (const skill of SKILLS) {
    const re = new RegExp(`(?<![\\w.#+-])${escape(skill.name)}(?![\\w#+])`, skill.caseSensitive ? '' : 'i');
    const m = full.match(re);
    if (m) findings.push({ category: 'habilidade', key: 'habilidade', value: skill.name, evidence: snippet(full, m.index, m[0].length), confidence: 0.35 });
  }
  return findings;
}

function fromGithub({ profile, repos }) {
  const findings = [];
  const ev = (what) => `GitHub (${profile.login}): ${what}`;
  if (profile.bio) {
    findings.push({ category: 'contexto', key: 'bio', value: profile.bio.trim(), evidence: ev(`bio "${profile.bio.trim()}"`), confidence: 0.8 });
    findings.push(...fromPage({ title: null, description: profile.bio, text: '' }).filter((f) => f.category === 'perfil'));
  }
  if (profile.company) {
    const company = profile.company.replace(/^@/, '').trim();
    findings.push({ category: 'contexto', key: 'empresa', value: company, evidence: ev(`empresa "${profile.company}"`), confidence: 0.7 });
  }
  if (profile.location) {
    findings.push({ category: 'contexto', key: 'localizacao', value: profile.location.trim(), evidence: ev(`localização "${profile.location}"`), confidence: 0.7 });
  }

  const count = (values) => [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
  for (const [language, n] of count(repos.map((r) => r.language).filter(Boolean)).slice(0, 8)) {
    findings.push({
      category: 'habilidade', key: 'habilidade', value: language,
      evidence: ev(`linguagem principal em ${n} de ${repos.length} repositórios próprios`),
      confidence: Math.min(0.9, 0.4 + n * 0.1),
    });
  }
  for (const [topic, n] of count(repos.flatMap((r) => r.topics)).filter(([, n]) => n >= 2).slice(0, 6)) {
    findings.push({ category: 'interesse', key: 'interesse', value: topic, evidence: ev(`tópico "${topic}" em ${n} repositórios`), confidence: 0.5 });
  }
  return findings;
}

export const stubExtractor = {
  name: 'stub',
  async extract({ collected }) {
    const findings = collected.kind === 'github' ? fromGithub(collected.github) : fromPage(collected.page);
    return findings.slice(0, MAX_FINDINGS);
  },
};
