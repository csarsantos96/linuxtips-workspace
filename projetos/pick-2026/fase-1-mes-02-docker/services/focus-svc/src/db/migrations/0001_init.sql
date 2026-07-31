-- focus-svc migration inicial.
-- Cria schema `focus` e tabela study_sessions.

CREATE SCHEMA IF NOT EXISTS focus;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS focus.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pomodoro','deep','custom')),
  planned_duration_s INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  actual_duration_s INT,
  status TEXT NOT NULL CHECK (status IN ('active','completed','abandoned')) DEFAULT 'active',
  note TEXT
);

CREATE INDEX IF NOT EXISTS study_sessions_user_started_idx
  ON focus.study_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS study_sessions_tenant_idx
  ON focus.study_sessions (tenant_id);
