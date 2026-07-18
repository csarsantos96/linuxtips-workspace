# cards-svc

Decks de flashcards com spaced repetition (algoritmo SM-2). Parte do **PICKStack** (PICK 2026 — LINUXtips).

Porta default: **8083**. Schema Postgres: **`cards`**.

## Endpoints

Headers `x-user-id` e `x-tenant-id` obrigatórios (UUIDs).

| Método | Rota | Descrição |
|---|---|---|
| GET    | `/healthz` | Liveness |
| GET    | `/readyz`  | Readiness (DB ping) |
| GET    | `/metrics` | Métricas Prometheus |
| POST   | `/decks` | Cria deck |
| GET    | `/decks` | Lista decks (próprios + públicos) |
| GET    | `/decks/:id` | Deck + `card_count` + `due_count` |
| PATCH  | `/decks/:id` | Atualiza (só owner) |
| DELETE | `/decks/:id` | Remove (só owner) |
| POST   | `/decks/:id/cards` | Cria card no deck |
| GET    | `/decks/:id/cards?limit=50&offset=0` | Lista cards |
| PATCH  | `/cards/:id` | Atualiza card |
| DELETE | `/cards/:id` | Remove card |
| POST   | `/cards/:id/review` | `{quality: 0-5}` → atualiza SRS + cria review |
| GET    | `/review/due?limit=20&deck_id?` | Cards com `due_at <= now` |
| GET    | `/stats/retention` | Agregado de quality |

## SM-2

Implementação em `src/lib/sm2.ts`. Regras:

- `EF' = EF + (0.1 - (5 - q)*(0.08 + (5 - q)*0.02))`, com piso `1.3`.
- `q < 3`: reseta `repetitions=0` e força `interval=1`.
- Caso contrário: incrementa `repetitions`; `r==1 → 1d`, `r==2 → 6d`, demais → `round(prev_interval * EF')`.
- `due_at = now + interval days`.

Testado em `tests/sm2_test.ts`.

## Variáveis de ambiente

| Var | Default | Descrição |
|---|---|---|
| `PORT` | `8083` | Porta HTTP |
| `DATABASE_URL` | — | Postgres URL |
| `LOG_LEVEL` | `info` | nível de log |
| `RUN_MIGRATIONS_ON_BOOT` | `true` | aplica `src/db/migrations/*.sql` no boot |

## Rodar

```bash
cp .env.example .env
deno task dev
```

## Testes

```bash
# Unit tests do SM-2 (sem DB)
deno test --allow-env --no-check tests/sm2_test.ts

# Happy path completo (precisa Postgres)
DATABASE_URL=postgres://pickstack:pickstack-dev@localhost:5432/pickstack deno task test
```

## Build

```bash
docker build -t pickstack/cards-svc:dev .
```
