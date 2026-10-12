-- Contas e sessões
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Pessoa: identidade, finalidade do gêmeo e preferências
CREATE TABLE persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users ON DELETE CASCADE,
  name text,
  -- { "areas": ["trabalho", ...], "decisoes": ["Vale a pena ...?", ...] }
  purpose jsonb NOT NULL DEFAULT '{}',
  preferences jsonb NOT NULL DEFAULT '{}',
  onboarding_step smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Objetivo: metas, prioridades e prazos
CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons ON DELETE CASCADE,
  title text NOT NULL,
  area text NOT NULL CHECK (area IN ('trabalho', 'estudo', 'pessoal', 'financas')),
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  deadline date,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'abandonado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX goals_person_idx ON goals (person_id);

-- Fonte: origem, endereço e data de coleta. Só existe com consentimento explícito.
CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('github', 'pagina')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'coletando', 'coletada', 'erro')),
  title text,
  error text,
  consented_at timestamptz NOT NULL,
  collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, url)
);

-- Informação: um fato ou declaração sobre a pessoa, com origem e status de validação
CREATE TABLE informations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('perfil', 'habilidade', 'interesse', 'contexto', 'rotina', 'compromisso', 'financas')),
  key text NOT NULL,
  value jsonb NOT NULL,
  -- declarada: a pessoa informou; extraida: sugerida a partir de uma fonte
  origin text NOT NULL CHECK (origin IN ('declarada', 'extraida')),
  source_id uuid REFERENCES sources ON DELETE RESTRICT,
  evidence text,
  confidence numeric(3, 2),
  status text NOT NULL CHECK (status IN ('pendente', 'confirmada', 'corrigida', 'rejeitada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (origin = 'declarada' OR source_id IS NOT NULL)
);
CREATE INDEX informations_person_status_idx ON informations (person_id, status);
CREATE INDEX informations_source_idx ON informations (source_id);

-- Histórico de alterações de cada informação
CREATE TABLE information_versions (
  id bigserial PRIMARY KEY,
  information_id uuid NOT NULL REFERENCES informations ON DELETE CASCADE,
  value jsonb NOT NULL,
  status text NOT NULL,
  actor text NOT NULL CHECK (actor IN ('pessoa', 'sistema')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX information_versions_info_idx ON information_versions (information_id);

-- Revisão: confirmação, correção ou rejeição de uma informação extraída
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  information_id uuid NOT NULL REFERENCES informations ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('confirmar', 'corrigir', 'rejeitar')),
  previous_value jsonb NOT NULL,
  new_value jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Decisão: alternativa escolhida, justificativa e a simulação que a embasou
CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons ON DELETE CASCADE,
  title text NOT NULL,
  context text,
  alternatives jsonb NOT NULL DEFAULT '[]',
  chosen text NOT NULL,
  rationale text,
  simulation jsonb,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decisions_person_idx ON decisions (person_id);

-- Resultado: o que ocorreu depois da decisão
CREATE TABLE outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES decisions ON DELETE CASCADE,
  description text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}',
  observed_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fila de processamento em segundo plano (coleta de fontes)
CREATE TABLE jobs (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executando', 'concluido', 'falhou')),
  attempts smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_ready_idx ON jobs (run_after) WHERE status = 'pendente';
