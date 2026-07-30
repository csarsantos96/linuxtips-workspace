# PICKStack — Guia de Desenvolvimento Local

Este guia é para quem está clonando o repositório **pela primeira vez** e quer
ver o stack rodando na própria máquina. Se algo aqui não funcionar, abra uma
issue com o output completo do comando que falhou.

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Por quê |
|---|---|---|
| Docker | 24.x | Container runtime |
| Docker Compose | v2.20+ | Orquestração local (já vem com Docker Desktop) |
| Deno | 2.x | Runtime dos microsserviços |
| Node.js | 20+ | SvelteKit (frontend) |
| pnpm | 9+ | Gerenciador de pacotes do frontend |
| Git | 2.40+ | Clonar o repo |
| make (opcional) | — | Atalhos para tarefas comuns |

Confira:

```bash
docker --version
docker compose version
deno --version
node --version
pnpm --version
```

---

## 2. Clonar o repositório

```bash
git clone git@github.com:linuxtips/pickstack.git
cd pickstack
```

---

## 3. Configurar variáveis de ambiente

```bash
cp infra/.env.dev.example infra/.env.dev
```

O arquivo `infra/.env.dev` já tem defaults seguros para dev local. Edite só se
precisar trocar portas (veja a tabela na seção 7).

---

## 4. Subir os datastores (Postgres, Redis, NATS, MinIO)

A forma mais comum durante o desenvolvimento é subir **só a infraestrutura** em
containers e rodar os serviços/frontend localmente (`deno task dev` /
`pnpm dev`), o que dá feedback mais rápido.

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.dev \
  --profile infra up -d
```

Confira:

```bash
docker compose -f infra/docker-compose.dev.yml ps
```

Você deve ver 4 containers saudáveis: `pickstack-postgres`, `pickstack-redis`,
`pickstack-nats`, `pickstack-minio`.

Endereços úteis:

- Postgres: `postgres://pickstack:pickstack-dev@localhost:5432/pickstack`
- Redis:    `redis://localhost:6379`
- NATS:     `nats://localhost:4222` (monitoring em `http://localhost:8222`)
- MinIO console: `http://localhost:9001` (login `pickstack` / `pickstack-dev`)

Os 4 schemas (`auth`, `focus`, `cards`, `trilha`) são criados automaticamente
pelo script `infra/docker/postgres-init.sql` no primeiro start. Para verificar:

```bash
docker exec -it pickstack-postgres \
  psql -U pickstack -d pickstack -c '\dn'
```

---

## 5. Subir tudo em containers (alternativa, "vai funcionar?")

Para um smoke test do stack inteiro empacotado:

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.dev \
  --profile services up -d --build
```

Adicione `web` (frontend) também:

```bash
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.dev \
  --profile web up -d --build
```

Abra `http://localhost:5173`.

> Os Dockerfiles dos serviços ainda estão em construção. Enquanto não existem,
> use a abordagem da seção 4 + seção 6 (rodar serviços diretamente com Deno).

---

## 6. Rodar os serviços diretamente (recomendado para desenvolvimento)

Cada serviço tem `deno task dev` (live reload). Em terminais separados:

```bash
# terminal 1
cd services/auth-svc && deno task dev

# terminal 2
cd services/focus-svc && deno task dev

# terminal 3
cd services/cards-svc && deno task dev

# terminal 4
cd services/trilha-svc && deno task dev

# terminal 5
cd services/api-gateway && deno task dev
```

Frontend:

```bash
cd web
pnpm install
pnpm dev      # http://localhost:5173
```

---

## 7. Mapa de portas

| Serviço | Porta | URL local |
|---|---|---|
| Postgres | 5432 | `localhost:5432` |
| Redis | 6379 | `localhost:6379` |
| NATS (clientes) | 4222 | `localhost:4222` |
| NATS (monitoring) | 8222 | `http://localhost:8222` |
| MinIO API (S3) | 9000 | `http://localhost:9000` |
| MinIO Console | 9001 | `http://localhost:9001` |
| api-gateway | 8080 | `http://localhost:8080` |
| auth-svc | 8081 | `http://localhost:8081` |
| focus-svc | 8082 | `http://localhost:8082` |
| cards-svc | 8083 | `http://localhost:8083` |
| trilha-svc | 8084 | `http://localhost:8084` |
| web (SvelteKit) | 5173 | `http://localhost:5173` |

---

## 8. Migrations e seed

Cada serviço gerencia seu próprio schema com **Drizzle**. Convenção:

```bash
cd services/auth-svc
deno task db:migrate    # roda migrations pendentes
deno task db:seed       # popula dados de exemplo (idempotente)
```

Repita para `focus-svc`, `cards-svc`, `trilha-svc`. Em desenvolvimento existe
um script-wrapper:

```bash
./scripts/db-bootstrap.sh   # roda migrate + seed em todos os serviços
```

---

## 9. Health checks

Todos os serviços expõem:

- `GET /healthz` — liveness (basic ping)
- `GET /readyz` — readiness (checa dependências: DB, Redis, NATS)
- `GET /metrics` — Prometheus

```bash
curl http://localhost:8081/healthz
curl http://localhost:8081/readyz
```

---

## 10. Rodar testes

```bash
# unit + integration em todos os serviços
deno task test                      # rode dentro de cada services/*

# testes do frontend
cd web && pnpm test
cd web && pnpm test:e2e             # Playwright
```

Os testes de integração assumem que os containers da seção 4 estão de pé.

---

## 11. Troubleshooting

### Erro "port is already allocated" / "address already in use"

Algum processo local já está ocupando a porta. Descubra:

```bash
# macOS / Linux
lsof -i :5432
lsof -i :6379
```

Mate o processo OU edite `infra/.env.dev` e mude a variável de porta
correspondente (`POSTGRES_PORT`, `REDIS_PORT`, etc.) — o docker compose
respeita esses valores.

### Postgres sobe mas os schemas não foram criados

O init script só roda **uma vez** (no primeiro start, com volume vazio). Para
forçar:

```bash
docker compose -f infra/docker-compose.dev.yml --profile infra down -v
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env.dev \
  --profile infra up -d
```

> `down -v` apaga os volumes — você perde os dados locais.

### NATS healthcheck "unhealthy"

Versões antigas do NATS não expõem `/healthz` na porta de monitoring. Confirme
que está rodando `nats:2.10-alpine` ou superior.

### "connection refused" entre serviços rodando com `deno task dev`

Os defaults apontam para `localhost`. Se você quiser conectar do host para os
serviços dentro do compose (ou vice-versa), use `host.docker.internal`
(macOS/Windows) ou `--network host` (Linux).

### MinIO "access denied"

O bucket ainda não existe. Crie via console (`http://localhost:9001`) ou via mc:

```bash
docker run --rm -it --network pickstack_pickstack-net minio/mc \
  alias set local http://minio:9000 pickstack pickstack-dev
docker run --rm -it --network pickstack_pickstack-net minio/mc \
  mb local/pickstack-uploads
```

### "permission denied" em volumes (Linux)

Em distros com SELinux/AppArmor, adicione `:z` aos volumes ou rode:

```bash
sudo chown -R 1000:1000 ~/.docker/volumes/pickstack_*
```

---

## 12. Limpar tudo

```bash
docker compose -f infra/docker-compose.dev.yml --profile web down -v
# -v apaga os volumes (perde dados locais; é o que você quer 99% das vezes)
```

---

## 13. Próximos passos

- Leia [docs/ARCHITECTURE.md](ARCHITECTURE.md) para entender as decisões.
- Leia [docs/MODULE-CONTRACT.md](MODULE-CONTRACT.md) antes de adicionar um módulo novo.
- Para deploy em Kubernetes, veja `infra/helm/pickstack/README.md` e
  `infra/argocd/README.md`.
