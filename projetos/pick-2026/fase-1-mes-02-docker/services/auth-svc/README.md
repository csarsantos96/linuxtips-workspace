# auth-svc

Serviço de identidade do PICKStack. Emite e valida JWTs, gerencia usuários, tenants e refresh tokens.

Stack: Deno 2.x + Hono 4 + Drizzle (postgres-js) + bcrypt + djwt (HS256).

## Endpoints

| Método | Path             | Descrição                                                    |
|--------|------------------|--------------------------------------------------------------|
| POST   | `/auth/signup`   | Cria usuário (e tenant pessoal se `tenant_slug` não vier).   |
| POST   | `/auth/login`    | Autentica e retorna access + refresh token.                  |
| POST   | `/auth/refresh`  | Rotaciona o refresh token e devolve novo access.             |
| POST   | `/auth/logout`   | Revoga um refresh token. Idempotente (204).                  |
| POST   | `/auth/password` | Troca senha do usuário (Bearer). Revoga refresh tokens.      |
| GET    | `/auth/me`       | Retorna o usuário do token (header `Authorization: Bearer`). |
| POST   | `/auth/verify`   | Valida um JWT. **Sempre 200** com `{valid: bool, ...}`.      |
| GET    | `/healthz`       | Liveness.                                                    |
| GET    | `/readyz`        | Readiness (faz `SELECT 1` no Postgres).                      |
| GET    | `/metrics`       | Métricas Prometheus.                                         |

### Contratos

`POST /auth/signup` body: `{ email, password, name?, tenant_slug? }` → 201 `{ user, token, refresh_token }`.
`POST /auth/login`  body: `{ email, password }` → 200 ou 401.
`POST /auth/refresh` body: `{ refresh_token }` → 200 `{ token, refresh_token }` (rotação) ou 401.
`POST /auth/verify`  body: `{ token }` → 200 `{ valid: true, user_id, tenant_id }` ou `{ valid: false, reason }`.
`POST /auth/logout`  body: `{ refresh_token }` → 204 (idempotente — revoga o RT informado).
`POST /auth/password` body: `{ old_password, new_password }` (Bearer) → 204; revoga todos os RTs ativos do usuário.

JWT claims: `{ sub: user_id, tnt: tenant_id, iat, exp, iss, aud }`. TTL padrão: 15 min (access), 30 dias (refresh).

Erros: `{ "error": "msg", "code": "CODE" }`.

## Env vars

| Variável                    | Default                                   | Descrição                              |
|-----------------------------|-------------------------------------------|----------------------------------------|
| `PORT`                      | `8081`                                    | Porta HTTP.                            |
| `DATABASE_URL`              | —                                         | Connection string Postgres.            |
| `JWT_SECRET`                | —                                         | Segredo HS256 (mín. 16 chars).         |
| `JWT_ISSUER`                | `pickstack`                               | Claim `iss`.                           |
| `JWT_AUDIENCE`              | `pickstack`                               | Claim `aud`.                           |
| `ACCESS_TOKEN_TTL_SECONDS`  | `900`                                     | TTL do access token.                   |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000`                                 | TTL do refresh token.                  |
| `RUN_MIGRATIONS_ON_BOOT`    | `true`                                    | Roda migrations ao subir.              |
| `LOG_LEVEL`                 | `info`                                    | `debug` / `info` / `warn` / `error`.   |
| `SERVICE_NAME`              | `auth-svc`                                | Label nos logs estruturados.           |
| `DB_POOL_MAX`               | `10`                                      | Pool máximo postgres-js.               |

## Como rodar local

```bash
cp .env.example .env
# Suba o Postgres do compose:
docker compose -f ../../infra/docker/docker-compose.dev.yml up -d postgres

deno task dev
# auth-svc subindo em http://localhost:8081
```

Smoke test rápido:

```bash
curl -s -X POST localhost:8081/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"supersecret","name":"Ada"}' | jq

curl -s -X POST localhost:8081/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"supersecret"}' | jq -r .token
```

## Como testar

```bash
deno task test
```

Os testes do runner padrão não exigem Postgres — usam um stub do Db e cobrem o contrato HTTP de `/healthz`, `/auth/me` (sem/com token), `/auth/verify`, validações de body e o ciclo sign/verify de JWT.

Para testes de integração contra Postgres real, suba o compose e exporte `DATABASE_URL` antes de rodar `deno task test`.

## Build

```bash
deno task build         # binário standalone em dist/auth-svc
docker build -t pickstack/auth-svc:dev .
```
