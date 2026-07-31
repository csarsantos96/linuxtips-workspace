# trilha-svc

Roadmaps de carreira com progresso por nó. Inclui um roadmap-seed **"DevOps PICK 2026"** com ~15 nodes (Linux → Docker → K8s → ArgoCD → observability → IaC). Parte do **PICKStack** (PICK 2026 — LINUXtips).

Porta default: **8084**. Schema Postgres: **`trilha`**.

## Endpoints

Headers `x-user-id` e `x-tenant-id` obrigatórios (UUIDs).

| Método | Rota | Descrição |
|---|---|---|
| GET    | `/healthz` | Liveness |
| GET    | `/readyz`  | Readiness (DB ping) |
| GET    | `/metrics` | Métricas Prometheus |
| GET    | `/roadmaps?scope=mine\|public\|all` | Lista roadmaps |
| POST   | `/roadmaps` | Cria roadmap + nodes em uma transação |
| GET    | `/roadmaps/:id` | Roadmap + nodes + progresso do user atual |
| PATCH  | `/roadmaps/:id` | Atualiza (só owner) |
| DELETE | `/roadmaps/:id` | Remove (só owner) |
| POST   | `/roadmaps/:id/clone` | Cópia editável de um roadmap público |
| PATCH  | `/nodes/:node_id/progress` | `{status: todo\|learning\|done, notes?}` |
| GET    | `/stats/overview` | Agregado de conclusão por roadmap |

## Seed

Na boot, se `SEED_DEFAULT_ROADMAP=true` (default), cria o roadmap público **"DevOps PICK 2026"**. É idempotente — se já existir, não duplica.

Use `POST /roadmaps/:id/clone` para o usuário gerar a própria cópia editável.

## Variáveis de ambiente

| Var | Default | Descrição |
|---|---|---|
| `PORT` | `8084` | Porta HTTP |
| `DATABASE_URL` | — | Postgres URL |
| `LOG_LEVEL` | `info` | nível de log |
| `RUN_MIGRATIONS_ON_BOOT` | `true` | aplica migrations no boot |
| `SEED_DEFAULT_ROADMAP` | `true` | injeta o roadmap-seed no boot |

## Rodar

```bash
cp .env.example .env
deno task dev
```

## Testes

```bash
DATABASE_URL=postgres://pickstack:pickstack-dev@localhost:5432/pickstack deno task test
```

## Build

```bash
docker build -t pickstack/trilha-svc:dev .
```
