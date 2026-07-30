# api-gateway

Ponto único de entrada externo do PICKStack. Faz CORS, rate limit, validação de JWT (delegada ao `auth-svc`), roteamento por prefixo e injeção de headers de contexto (`x-user-id`, `x-tenant-id`, `x-request-id`).

Stack: Deno 2.x + Hono 4.

## Roteamento

| Prefixo do gateway | Upstream             | Requer JWT? |
|--------------------|----------------------|-------------|
| `/api/auth/*`      | `AUTH_SVC_URL`       | Não         |
| `/api/focus/*`     | `FOCUS_SVC_URL`      | Sim         |
| `/api/cards/*`     | `CARDS_SVC_URL`      | Sim         |
| `/api/trilha/*`    | `TRILHA_SVC_URL`     | Sim         |

O prefixo é **removido** antes do encaminhamento — `/api/focus/sessions` chega no upstream como `/sessions`.

## Endpoints utilitários

| Método | Path        | Descrição                                                              |
|--------|-------------|------------------------------------------------------------------------|
| GET    | `/healthz`  | Liveness.                                                              |
| GET    | `/readyz`   | Readiness — checa `GET /healthz` no `auth-svc`.                        |
| GET    | `/metrics`  | Métricas Prometheus (`http_requests_total`, duração, upstream, etc.).  |

## Validação de JWT

Para qualquer rota fora de `/api/auth/*`, o gateway chama `POST {AUTH_SVC_URL}/auth/verify` com o token do header `Authorization: Bearer`. O resultado é cacheado em memória por `VERIFY_CACHE_TTL_SECONDS` (default 60s).

Quando válido, injeta no upstream:
- `x-user-id`
- `x-tenant-id`
- `x-request-id`
- `x-forwarded-by: pickstack-api-gateway`

Token inválido / ausente => 401 `{"error": "...", "code": "MISSING_TOKEN" | "INVALID_TOKEN"}`.

## Rate limit

Sliding window por IP (`x-forwarded-for` → `x-real-ip` → fallback `anonymous`).

| Backend           | Quando                                                                |
|-------------------|------------------------------------------------------------------------|
| Redis (sorted set)| `REDIS_URL` setado. Estado global, recomendado em prod multi-pod.     |
| Memória           | Caso contrário. Per-pod, OK para dev/lab.                             |

Exceeded => 429 `{"error": "...", "code": "RATE_LIMITED"}` + headers `x-ratelimit-limit` / `x-ratelimit-remaining`.

Rotas `/healthz`, `/readyz` e `/metrics` são isentas.

## Env vars

| Variável                       | Default                  | Descrição                                       |
|--------------------------------|--------------------------|-------------------------------------------------|
| `PORT`                         | `8080`                   | Porta HTTP.                                     |
| `AUTH_SVC_URL`                 | —                        | URL base do auth-svc.                           |
| `FOCUS_SVC_URL`                | —                        | URL base do focus-svc.                          |
| `CARDS_SVC_URL`                | —                        | URL base do cards-svc.                          |
| `TRILHA_SVC_URL`               | —                        | URL base do trilha-svc.                         |
| `ALLOWED_ORIGINS`              | `*`                      | CSV; em prod restrinja a origens conhecidas.    |
| `RATE_LIMIT_WINDOW_SECONDS`    | `60`                     | Janela do rate limit.                           |
| `RATE_LIMIT_MAX`               | `100`                    | Limite máximo por IP por janela.                |
| `REDIS_URL`                    | —                        | Se ausente, fallback in-memory.                 |
| `VERIFY_CACHE_TTL_SECONDS`     | `60`                     | TTL do cache de `/auth/verify`.                 |
| `UPSTREAM_TIMEOUT_MS`          | `15000`                  | Timeout para chamadas aos upstreams.            |
| `LOG_LEVEL`                    | `info`                   | `debug`/`info`/`warn`/`error`.                  |
| `SERVICE_NAME`                 | `api-gateway`            | Label nos logs estruturados.                    |

## Como rodar local

```bash
cp .env.example .env
# Suba o auth-svc em outra aba (porta 8081).
deno task dev
# Gateway sobe em http://localhost:8080
```

Smoke test:

```bash
# signup via gateway
curl -s -X POST localhost:8080/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"supersecret"}' | jq

# rota protegida sem token
curl -i localhost:8080/api/focus/sessions   # => 401

# /metrics
curl -s localhost:8080/metrics | head
```

## Como testar

```bash
deno task test
```

Os testes sobem servidores stub locais para simular `auth-svc` e os upstreams; cobrem healthz, 401 sem token, proxy para `/api/auth/*`, injeção de `x-user-id`/`x-tenant-id` em rota protegida e disparo do rate limit.

## Build

```bash
deno task build
docker build -t pickstack/api-gateway:dev .
```
