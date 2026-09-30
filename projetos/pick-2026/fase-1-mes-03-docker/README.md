# PICKStack

> **Projeto prático oficial do PICK** (Programa Intensivo em Containers e Kubernetes — LINUXtips, turma 2026) — uma plataforma SaaS modular de operações de estudo, desenhada para ser **operada pelos alunos** ao longo de 12 meses de Docker, Kubernetes, ArgoCD, CKA e CKAD.

[![LINUXtips](https://img.shields.io/badge/LINUXtips-PICK%202026-orange)](https://linuxtips.io)
[![Stack](https://img.shields.io/badge/stack-Deno%20%7C%20SvelteKit%20%7C%20Postgres%20%7C%20K8s-blue)](#stack)

---

## O que é

PICKStack é um SaaS de "operações de estudo" composto por **módulos plugáveis** — cada módulo é um microsserviço independente. Os alunos do PICK não apenas usam a plataforma para organizar seus próprios estudos; eles operam a infraestrutura: empacotam containers, escrevem manifestos Kubernetes, configuram ArgoCD, gerenciam observabilidade, e investigam incidentes em produção.

**Módulos do MVP:**

| Módulo | O que faz |
|---|---|
| **focus** | Sessões pomodoro, streak diário, heatmap |
| **cards** | Flashcards com spaced repetition (SM-2) |
| **trilha** | Roadmaps de carreira, progresso por nó |

**Módulos futuros:** `journal` (diário de bordo), `simulados` (mock exams CKA/CKAD), `comunidade` (grupos + mentor marketplace), `integrations` (GitHub, YouTube, Notion).

---

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | **SvelteKit 2** + Tailwind | DX leve, SSR opcional, easy multi-stage Dockerfile |
| Backend | **Deno** + Hono + Drizzle ORM | Alinha com o stack do MESA; binário pequeno; ótimo Dockerfile |
| Datastore | **Postgres 16** | StatefulSet pedagógico em K8s; managed em SaaS |
| Cache | **Redis 7** | Sessions, rate-limit, cache de queries |
| Mensageria | **NATS JetStream** | Mais leve que Kafka, ótimo para ensinar event-driven |
| Object storage | **MinIO** | S3-compatible, exporta como Service no K8s |
| Observabilidade | **Prometheus + Grafana + Loki + Tempo** | ServiceMonitor por módulo |
| GitOps | **ArgoCD** | App-of-apps, sync waves, image updater |
| Pacote | **Helm chart** | 1 chart por módulo, umbrella chart no topo |

---

## Arquitetura

```
                        ┌──────────────┐
                        │     web      │  SvelteKit, multi-stage, Ingress + TLS
                        └──────┬───────┘
                               │
                       ┌───────▼────────┐
                       │  api-gateway   │  Hono, rate limit, auth check
                       └───────┬────────┘
                               │
       ┌──────────┬────────────┼────────────┬──────────────┐
       ▼          ▼            ▼            ▼              ▼
   auth-svc   focus-svc    cards-svc   trilha-svc   (future: journal-svc, …)
       │          │            │            │
       └──────────┴──── Postgres / Redis / NATS / MinIO ────┘

Workers/CronJobs:
  - srs-scheduler (CronJob diário)         → calcula cards "due"
  - stats-recompute (CronJob)              → streaks, heatmaps
  - notification-dispatcher (Deployment)   → consome fila NATS

Observability:
  - Prometheus + Grafana + Loki + Tempo + Alertmanager

GitOps:
  - ArgoCD app-of-apps, 1 Application por módulo
  - Sync waves: infra → datastore → backend → frontend
```

Cada serviço é independente: tem seu próprio Dockerfile, seu próprio chart, seu próprio banco lógico (schema separado no Postgres). Você pode desligar `cards` e o resto continua funcionando.

---

## Layout do monorepo

```
pickstack/
├── services/                # microsserviços (Deno/Hono)
│   ├── auth-svc/
│   ├── api-gateway/
│   ├── focus-svc/
│   ├── cards-svc/
│   └── trilha-svc/
├── web/                     # frontend SvelteKit
├── infra/
│   ├── docker-compose.dev.yml
│   ├── helm/                # 1 chart por serviço + umbrella
│   └── argocd/              # app-of-apps + Applications
├── docs/
│   ├── ARCHITECTURE.md      # decisões técnicas
│   ├── DEVELOPMENT.md       # como rodar local
│   ├── MODULE-CONTRACT.md   # como adicionar um novo módulo
│   └── PEDAGOGICAL-PLAN.md  # mapeamento PICK → entregas no projeto
└── scripts/                 # utilitários (provisionamento, seeders, etc.)
```

---

## Quickstart (dev local)

> Pré-requisitos: Docker, docker-compose, Deno 2.x, Node 20+, pnpm.

```bash
git clone git@github.com:linuxtips/pickstack.git
cd pickstack

# sobe postgres, redis, nats e os serviços em containers
docker compose -f infra/docker-compose.dev.yml up -d

# frontend
cd web
pnpm install
pnpm dev   # http://localhost:5173
```

Detalhes (env vars, migrations, seed) em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Como o PICK 2026 vai usar este repo

Cada aluno faz fork e opera o projeto no cluster dele. Ao longo do curso:

| Fase | Foco curricular | Entrega no projeto |
|---|---|---|
| Mês 1-3 | **Descomplicando Docker** | Multi-stage Dockerfiles, docker compose, image scanning |
| Mês 4-6 | **Descomplicando Kubernetes** ⟵ vocês estão aqui | Deployments, Services, Ingress, ConfigMap/Secret, HPA, NetworkPolicy, StatefulSet, RBAC |
| Mês 7 | **CKA prep** | Cluster ops, etcd backup, troubleshooting |
| Mês 8 | **CKAD prep** | Helm charts, init containers, probes, jobs, multi-container patterns |
| Mês 9-10 | **Descomplicando ArgoCD** | App-of-apps, sync waves, image updater, rollback |
| Mês 11-12 | **Mentoria + projeto final** | Cada aluno escreve um módulo novo OU operacionaliza um com SLOs |

Roteiro detalhado em [docs/PEDAGOGICAL-PLAN.md](docs/PEDAGOGICAL-PLAN.md).

---

## Status

🚧 **Em construção (Q2 2026)** — Bootstrap do MVP em andamento. Não é estável para produção ainda. Acompanhe o board de issues para ver o que está pronto.

---

## Licença

MIT — use, estude, compartilhe.

---

**PICKStack** é mantido pela comunidade **LINUXtips** como projeto prático do **PICK 2026**. Feito com 💜 por quem acredita que Cloud Native se aprende **operando**, não lendo slide.
