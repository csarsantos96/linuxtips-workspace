# focus-svc

Sessões de estudo (pomodoro/deep/custom), streak diário, heatmap e progresso do dia. Faz parte do **PICKStack** (PICK 2026 — LINUXtips).

Porta default: **8082**. Schema Postgres: **`focus`**.

## Endpoints

Todos os endpoints (exceto health/metrics) exigem headers `x-user-id` e `x-tenant-id` (UUIDs), injetados pelo `api-gateway`.

| Método | Rota | Descrição |
|---|---|---|
| GET  | `/healthz` | Liveness |
| GET  | `/readyz`  | Readiness (ping no DB) |
| GET  | `/metrics` | Métricas Prometheus |
| POST | `/sessions/start` | Inicia sessão `{type, duration_min, note?}` |
| POST | `/sessions/:id/end` | Encerra (status=completed) |
| POST | `/sessions/:id/abandon` | Abandona (status=abandoned) |
| GET  | `/sessions?from=ISO&to=ISO&limit=50&offset=0` | `{items, total}` — lista paginada |
| GET  | `/sessions/today` | `{items}` — sessões iniciadas hoje (UTC) |
| GET  | `/stats/streak` | `{current_days, longest_days, last_session_at}` |
| GET  | `/stats/heatmap?days=90` | `[{date, total_minutes, session_count}]` |
| GET  | `/stats/today` | `{sessions_today, minutes_today, daily_goal_min, goal_pct}` |

## Variáveis de ambiente

| Var | Default | Descrição |
|---|---|---|
| `PORT` | `8082` | Porta HTTP |
| `DATABASE_URL` | — | `postgres://user:pass@host:5432/db` |
| `LOG_LEVEL` | `info` | `debug | info | warn | error` |
| `DAILY_GOAL_MIN` | `50` | Meta diária em minutos |
| `RUN_MIGRATIONS_ON_BOOT` | `true` | Aplica `src/db/migrations/*.sql` no boot |

Veja `.env.example`.

## Como rodar (dev)

```bash
cp .env.example .env
deno task dev
```

## Testes

```bash
# happy path real (precisa de Postgres rodando)
DATABASE_URL=postgres://pickstack:pickstack-dev@localhost:5432/pickstack deno task test
```

## Build

```bash
docker build -t pickstack/focus-svc:dev .
```
