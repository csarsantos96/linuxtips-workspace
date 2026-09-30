-- PICKStack — bootstrap do Postgres para dev local.
-- Cria 1 schema por serviço. Em produção, cada serviço também usa seu próprio schema.
-- Idempotente: pode rodar várias vezes sem erro.

CREATE SCHEMA IF NOT EXISTS auth   AUTHORIZATION pickstack;
CREATE SCHEMA IF NOT EXISTS focus  AUTHORIZATION pickstack;
CREATE SCHEMA IF NOT EXISTS cards  AUTHORIZATION pickstack;
CREATE SCHEMA IF NOT EXISTS trilha AUTHORIZATION pickstack;

-- Extensões úteis para todos os serviços.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Cada serviço será o owner do seu próprio schema; aqui só garantimos
-- que o role pickstack tem privilégio total (válido para dev local).
GRANT ALL PRIVILEGES ON SCHEMA auth, focus, cards, trilha TO pickstack;
