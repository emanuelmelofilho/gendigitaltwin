import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHtml } from '../src/collect/html.js';
import { internalCandidates, profileCandidates, urlKey } from '../src/collect/links.js';
import { buildQuery } from '../src/search/index.js';

const html = `
  <a href="/sobre">Sobre mim</a>
  <a href="/projetos/">Projetos</a>
  <a href="/blog/post-1">Post</a>
  <a href="/blog/2026/learning-about-sqlite/">Learning about SQLite in production</a>
  <a href="/menu">Sobre mim</a>
  <a href="/contato">Contato</a>
  <a href="cv.pdf">Currículo em PDF</a>
  <a href="https://www.ana.dev/about#top">About</a>
  <a data-href="/ignorar" href="/trabalhos">Meus trabalhos</a>
  <a href="https://github.com/ana-dev">GitHub</a>
  <a href="https://github.com/ana-dev/repo">Repo</a>
  <a href="https://outra-pessoa.github.io/projeto/">Projeto de outra pessoa</a>
  <a href="https://www.linkedin.com/in/ana">LinkedIn</a>
  <a rel="me noopener" href="https://mastodon.social/@ana">Mastodon</a>
  <a href="https://exemplo.com/artigo">Artigo qualquer</a>
  <a href="mailto:ana@ana.dev">E-mail</a>`;

test('parseHtml devolve links absolutos e lê href mesmo com data-href antes', () => {
  const { links } = parseHtml(html, new URL('https://ana.dev/'));
  assert.ok(links.some((l) => l.url === 'https://ana.dev/trabalhos'));
  assert.ok(!links.some((l) => l.url.includes('ignorar') || l.url.startsWith('mailto')));
});

test('páginas internas: só do mesmo site, relevantes, sem arquivos e sem repetir', () => {
  const { links } = parseHtml(html, new URL('https://ana.dev/'));
  assert.deepEqual(internalCandidates(links, 'https://ana.dev/', 10), [
    'https://ana.dev/sobre', 'https://ana.dev/projetos/', 'https://ana.dev/menu', 'https://www.ana.dev/about', 'https://ana.dev/trabalhos',
  ]);
  assert.equal(internalCandidates(links, 'https://ana.dev/', 2).length, 2);
});

test('perfis externos: padrões conhecidos e rel="me", sem redes que bloqueiam robôs', () => {
  const { links } = parseHtml(html, new URL('https://ana.dev/'));
  assert.deepEqual(profileCandidates(links, 'https://ana.dev/', 10).map((s) => s.url), [
    'https://github.com/ana-dev', 'https://mastodon.social/@ana',
  ]);
});

test('urlKey ignora esquema, www e barra final', () => {
  assert.equal(urlKey('http://www.jvns.ca/'), urlKey('https://jvns.ca'));
  assert.notEqual(urlKey('https://jvns.ca/about'), urlKey('https://jvns.ca/'));
});

test('consulta de busca usa o nome entre aspas e os termos escolhidos', () => {
  assert.equal(buildQuery('Ana "Silva"', ' Recife desenvolvedora '), '"Ana Silva" Recife desenvolvedora');
  assert.equal(buildQuery('Ana Silva'), '"Ana Silva"');
});
