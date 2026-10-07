-- cards-svc migration inicial.
-- Schema `cards` + tabelas decks, cards, reviews.

CREATE SCHEMA IF NOT EXISTS cards;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS cards.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decks_tenant_owner_idx ON cards.decks (tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS decks_public_idx ON cards.decks (is_public) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS cards.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES cards.decks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tags TEXT[],
  easiness REAL NOT NULL DEFAULT 2.5,
  interval_days INT NOT NULL DEFAULT 0,
  repetitions INT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cards_deck_idx ON cards.cards (deck_id);
CREATE INDEX IF NOT EXISTS cards_tenant_due_idx ON cards.cards (tenant_id, due_at);

CREATE TABLE IF NOT EXISTS cards.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards.cards(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  quality SMALLINT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  prev_easiness REAL NOT NULL,
  next_easiness REAL NOT NULL,
  next_interval_days INT NOT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_card_idx ON cards.reviews (card_id);
CREATE INDEX IF NOT EXISTS reviews_tenant_user_idx ON cards.reviews (tenant_id, user_id);
