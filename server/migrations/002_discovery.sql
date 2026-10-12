-- Buscas pelo nome da pessoa (sempre iniciadas por ela)
CREATE TABLE searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons ON DELETE CASCADE,
  query text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executando', 'concluida', 'erro')),
  results_count int,
  error text,
  consented_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX searches_person_idx ON searches (person_id);

-- Fontes descobertas pelo robô entram como "sugerida" e só são coletadas depois de aprovadas.
ALTER TABLE sources DROP CONSTRAINT sources_status_check;
ALTER TABLE sources ADD CONSTRAINT sources_status_check
  CHECK (status IN ('sugerida', 'descartada', 'pendente', 'coletando', 'coletada', 'erro'));
ALTER TABLE sources ALTER COLUMN consented_at DROP NOT NULL;
ALTER TABLE sources ADD CONSTRAINT sources_consent_check
  CHECK (consented_at IS NOT NULL OR status IN ('sugerida', 'descartada'));

ALTER TABLE sources
  -- pessoa: link informado; pagina: apontado por outra fonte; busca: resultado de busca pelo nome
  ADD COLUMN discovered_via text NOT NULL DEFAULT 'pessoa' CHECK (discovered_via IN ('pessoa', 'pagina', 'busca')),
  ADD COLUMN discovered_from uuid REFERENCES sources ON DELETE SET NULL,
  ADD COLUMN search_id uuid REFERENCES searches ON DELETE SET NULL,
  ADD COLUMN snippet text,
  -- Páginas efetivamente lidas na última coleta (a principal e as internas visitadas)
  ADD COLUMN pages jsonb NOT NULL DEFAULT '[]';

-- Página exata de onde saiu a evidência (pode ser uma página interna da fonte)
ALTER TABLE informations ADD COLUMN evidence_url text;
