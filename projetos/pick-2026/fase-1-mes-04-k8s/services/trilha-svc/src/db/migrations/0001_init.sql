-- trilha-svc migration inicial.
-- Schema `trilha` + tabelas roadmaps, roadmap_nodes, user_progress.

CREATE SCHEMA IF NOT EXISTS trilha;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS trilha.roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS roadmaps_tenant_owner_idx ON trilha.roadmaps (tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS roadmaps_public_idx ON trilha.roadmaps (is_public) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS trilha.roadmap_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES trilha.roadmaps(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  depends_on TEXT[],
  resources JSONB,
  order_index INT,
  UNIQUE (roadmap_id, external_id)
);

CREATE INDEX IF NOT EXISTS roadmap_nodes_roadmap_idx ON trilha.roadmap_nodes (roadmap_id);

CREATE TABLE IF NOT EXISTS trilha.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  node_id UUID NOT NULL REFERENCES trilha.roadmap_nodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('todo','learning','done')) DEFAULT 'todo',
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, node_id)
);

CREATE INDEX IF NOT EXISTS user_progress_user_idx ON trilha.user_progress (tenant_id, user_id);
