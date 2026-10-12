# Gerador de Gêmeo Digital

Um perfil que evolui: a pessoa informa seus dados, revisa o que foi encontrado nas fontes que ela escolheu
e registra decisões e resultados ao longo do tempo. No MVP, o gêmeo compara cenários de **tempo e finanças**
(ex.: “se eu dedicar 4 h semanais a uma renda extra, quanto tempo sobra para estudo e família, e quanto muda o saldo do mês?”).

## Como rodar

Requisitos: Node 22+ e Docker.

```bash
cp .env.example .env      # se ainda não existir
npm install
npm run db:up             # PostgreSQL 16 na porta 5433
npm run migrate
npm run dev               # API (3333) + worker + front (5173)
```

Abra http://localhost:5173. Testes: `npm test`.

## Fluxo

| Etapa | Tela | O que é gravado |
| --- | --- | --- |
| 1. Objetivo | `/cadastro/1` | `persons.purpose` (áreas e decisões a simular) e `goals` |
| 2. Perfil inicial | `/cadastro/2` | Informações declaradas: profissão, contexto, habilidades, interesses |
| 3. Rotina e recursos | `/cadastro/3` | Sono, trabalho, deslocamento, metas de estudo/família, compromissos, renda e despesas |
| 4. Fontes externas | `/cadastro/4` | `sources` (com consentimento) + job de coleta em segundo plano |
| 5. Validação | `/revisao` | `reviews`; a informação vira confirmada, corrigida ou rejeitada |
| 6. Evolução | `/historico`, `/perfil` | `decisions`, `outcomes` e novas versões de informações |

`/cenarios` compara a situação atual com até três cenários e permite registrar a decisão com o instantâneo da simulação.

## Arquitetura

```
client/  React + Vite (proxy /api → API)
server/
  src/app.js              rotas Express
  src/auth.js             contas (scrypt) e sessões em cookie httpOnly
  src/catalog.js          chaves de informação aceitas e validação dos valores
  src/services/           informações (versões e revisão), linha de base e simulação
  src/collect/            coleta: GitHub (API oficial) e páginas (robots.txt, bloqueio de IPs internos, limites)
  src/extract/            extratores; hoje só o "stub" (heurísticas, sem IA)
  src/worker.js           fila em Postgres (FOR UPDATE SKIP LOCKED) com novas tentativas
  migrations/             SQL
```

### Modelo de dados

- **Informação** (`informations`) guarda categoria, chave, valor (JSONB), **origem** (`declarada` ou `extraida`),
  fonte, evidência (trecho), confiança e **status** (`pendente`, `confirmada`, `corrigida`, `rejeitada`).
  Toda alteração gera uma linha em `information_versions`.
- Só entram nas simulações informações `confirmada` ou `corrigida`. Para chaves de valor único, vale a mais recente.
- O que a pessoa rejeita não é sugerido de novo em coletas futuras.
- Cada premissa da simulação mostra de onde veio: informada pela pessoa, fonte externa ou valor padrão.

### Coleta de fontes

1. A pessoa informa o link e marca a autorização (`consent: true` é obrigatório na API).
2. A API grava a fonte e enfileira `coletar_fonte`; o worker coleta sem bloquear o cadastro.
3. O extrator devolve achados com evidência; eles entram como `pendente`.
4. A pessoa revisa cada achado.

Não há busca por nome. Páginas são coletadas só se o `robots.txt` permitir; endereços internos/privados são recusados.
Por enquanto só HTML e texto são lidos (PDF de currículo ainda não).

### Trocar o extrator por IA

Crie um módulo em `server/src/extract/` com `extract({ source, collected })` retornando
`[{ category, key, value, evidence, confidence }]` (chaves de `catalog.js`), registre em `extract/index.js` e defina
`EXTRACTOR` no `.env`. O worker já valida cada achado contra o catálogo antes de gravar.

## Limitações conhecidas do MVP

- Sem limite de tentativas de login nem verificação de e-mail.
- A proteção contra endereços internos verifica o DNS antes da conexão; em produção, use um proxy de saída para evitar DNS rebinding.
- A simulação é determinística e simples (168 h por semana, 4,33 semanas por mês); resultados são estimativas.
