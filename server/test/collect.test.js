import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermanentError } from '../src/collect/errors.js';
import { parseHtml } from '../src/collect/html.js';
import { isPathAllowed } from '../src/collect/robots.js';
import { safeFetch } from '../src/collect/safeFetch.js';
import { stubExtractor } from '../src/extract/stub.js';

test('robots.txt: regra mais longa vence e grupo específico tem prioridade', () => {
  const robots = `User-agent: *\nDisallow: /privado\nAllow: /privado/publico\n\nUser-agent: OutroBot\nDisallow: /`;
  assert.equal(isPathAllowed(robots, '/sobre'), true);
  assert.equal(isPathAllowed(robots, '/privado/x'), false);
  assert.equal(isPathAllowed(robots, '/privado/publico/x'), true);
  assert.equal(isPathAllowed('User-agent: GenDigitalTwinBot\nDisallow: /\n\nUser-agent: *\nAllow: /', '/x'), false);
  assert.equal(isPathAllowed('User-agent: *\nDisallow: /*.pdf$', '/cv.pdf'), false);
});

test('safeFetch recusa endereços internos', async () => {
  for (const url of ['http://127.0.0.1/', 'http://localhost:5433/', 'http://169.254.169.254/latest', 'http://[::1]/', 'file:///etc/passwd']) {
    await assert.rejects(safeFetch(url), PermanentError, url);
  }
});

test('parseHtml extrai título, descrição e texto sem scripts', () => {
  const page = parseHtml(`<html><head><title>Ana &amp; Dev</title><meta name="description" content="Desenvolvedora front-end"></head>
    <body><script>var x = "React"</script><p>Trabalho com TypeScript</p></body></html>`);
  assert.equal(page.title, 'Ana & Dev');
  assert.equal(page.description, 'Desenvolvedora front-end');
  assert.equal(page.text, 'Trabalho com TypeScript');
});

test('extrator stub aponta evidência e evita falsos positivos de palavras comuns', async () => {
  const findings = await stubExtractor.extract({
    collected: {
      kind: 'pagina',
      pages: [
        { url: 'https://ana.dev/', title: 'Ana — Desenvolvedora front-end', description: null, text: 'Uso React. Let us go to the park; I excel at rust removal.' },
        { url: 'https://ana.dev/projetos', title: null, description: null, text: 'Projeto em Node.js' },
      ],
    },
  });
  const values = findings.map((f) => f.value);
  assert.ok(values.includes('Desenvolvedora front-end'));
  assert.ok(values.includes('React') && values.includes('Node.js'));
  assert.ok(!values.includes('Go') && !values.includes('Excel') && !values.includes('Rust'));
  assert.ok(findings.every((f) => f.evidence && f.confidence > 0));
  assert.equal(findings.find((f) => f.value === 'Node.js').evidenceUrl, 'https://ana.dev/projetos');
});

test('extrator stub resume linguagens e tópicos do GitHub', async () => {
  const repos = [
    { language: 'TypeScript', topics: ['finance', 'react'] },
    { language: 'TypeScript', topics: ['finance'] },
    { language: 'Python', topics: [] },
  ];
  const findings = await stubExtractor.extract({
    collected: { kind: 'github', github: { profile: { login: 'ana', bio: 'Software engineer', company: '@acme', location: 'Recife' }, repos } },
  });
  assert.deepEqual(findings.filter((f) => f.category === 'habilidade').map((f) => f.value), ['TypeScript', 'Python']);
  assert.deepEqual(findings.filter((f) => f.category === 'interesse').map((f) => f.value), ['finance']);
  assert.equal(findings.find((f) => f.key === 'empresa').value, 'acme');
  assert.ok(findings.some((f) => f.key === 'profissao' && f.value === 'Software engineer'));
});
