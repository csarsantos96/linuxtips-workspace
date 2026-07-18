# PICKStack — Arquitetura

Documento de decisões técnicas e estrutura geral. Quando uma decisão muda, atualize aqui.

---

## 1. Princípios

1. **Modularidade real.** Cada módulo é um serviço independente: próprio repo lógico (dentro do monorepo), próprio Dockerfile, próprio schema no banco, próprio chart Helm. Desligar um módulo não derruba os outros.
2. **Cloud-native por design.** Stateless onde possível, configuração via env, métricas Prometheus, logs estruturados em stdout, health checks padronizados.
3. **GitOps obrigatório em prod.** Nenhuma mudança em produção entra fora do fluxo ArgoCD → manifesto Git → sync.
4. **Pedagogia em primeiro lugar.** Decisões priorizam o que ensina mais sobre Docker/K8s/ArgoCD/CKA/CKAD, mesmo quando há alternativa "mais simples".
5. **SaaS-ready.** Multi-tenant desde o dia 1 (`tenant_id` em todas as tabelas de domínio).

---

## 2. Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | SvelteKit | 2.x |
| CSS | Tailwind CSS | 3.x |
| Backend runtime | Deno | 2.x |
| HTTP framework | Hono | 4.x |
| ORM | Drizzle | última |
| DB | Postgres | 16 |
| Cache | Redis | 7 |
| Mensageria | NATS JetStream | 2.10 |
| Object storage | MinIO | última |
| Observability | Prometheus, Grafana, Loki, Tempo, Alertmanager | kube-prometheus-stack |
| Pacote K8s | Helm | 3.x |
| GitOps | ArgoCD | 2.x |

---

## 3. Topologia de serviços (MVP)

```
                            ┌──────────────┐
                            │     web      │
                            └──────┬───────┘
                                   │
                          ┌────────▼─────────┐
                          │   api-gateway    │
                          └────────┬─────────┘
                                   │
            ┌──────────┬───────────┼───────────┬───────────────┐
            ▼          ▼           ▼           ▼               ▼
        auth-svc   focus-svc   cards-svc   trilha-svc    (futuro)
            │          │           │           │
            └──────────┴── Postgres / Redis / NATS / MinIO ─┘
```

### Responsabilidades

- **web** — SPA + SSR opcional. Conhece apenas a URL do `api-gateway`. Não fala com módulos diretamente.
- **api-gateway** — único ponto de entrada externo. Faz: TLS termination (via Ingress, na verdade), CORS, rate limit, validação de JWT (chamando `auth-svc` ou validando localmente com chave pública), roteamento por prefixo (`/api/auth/*`, `/api/focus/*`, ...).
- **auth-svc** — identidade. Emite e valida JWTs. Tabela `users`, `sessions`, `tenants`.
- **focus-svc** — sessões de estudo (pomodoro). Tabela `study_sessions`. Calcula streak em runtime; heatmap por query agregada.
- **cards-svc** — decks/cards/reviews. Algoritmo SM-2. Tabelas `decks`, `cards`, `reviews`.
- **trilha-svc** — roadmaps. Tabelas `roadmaps`, `roadmap_nodes`, `user_progress`.

### Comunicação

- **Síncrona (HTTP):** `api-gateway` ↔ módulos. Internamente, módulos **não** se chamam por HTTP — usam eventos.
- **Assíncrona (NATS):** módulos publicam eventos de domínio (`focus.session.ended`, `cards.review.done`). Consumidores: `stats-recompute`, `notification-dispatcher`, futuros.

### Persistência

- 1 cluster Postgres, **1 schema por serviço** (`auth`, `focus`, `cards`, `trilha`). Em SaaS hosted, pode virar 1 DB por tenant; em lab K8s, 1 cluster compartilhado é suficiente.
- Redis compartilhado, segregação por prefixo de chave (`auth:`, `focus:`, ...).
- MinIO bucket por serviço.

---

## 4. Multi-tenancy

- Todo objeto de domínio carrega `tenant_id` (uuid).
- JWT carrega `sub` (user_id) e `tnt` (tenant_id).
- Middleware do gateway injeta `x-tenant-id` no header antes de encaminhar para módulos.
- Módulos sempre filtram `WHERE tenant_id = $1` — **enforcado por convenção, validado em testes**.

Para o aluno operar seu próprio cluster:
- Tenant default `local-dev` no docker-compose.
- Em K8s, namespace = `pickstack-<env>`.

---

## 5. Autenticação

- JWT assinado com chave RS256 (par público/privado em Secret K8s).
- `auth-svc` é o único emissor. Outros serviços validam o token com a chave pública (vem como ConfigMap).
- Refresh tokens em Redis, com TTL.
- Multi-fator é roadmap futuro (após MVP).

---

## 6. Observabilidade

- **Métricas:** cada serviço expõe `/metrics` (Prometheus). Métricas obrigatórias por serviço:
  - `http_request_duration_seconds` (histogram, labels: method, route, status)
  - `http_requests_total` (counter)
  - métricas de domínio (ex: `focus_session_duration_seconds`, `cards_reviews_total`)
- **Logs:** estruturados em JSON, stdout. Loki coleta via Promtail.
- **Tracing:** OpenTelemetry SDK em todos os serviços, Tempo coletor.
- **Health:** `/healthz` (liveness) e `/readyz` (readiness) padronizados.

---

## 7. GitOps com ArgoCD

```
infra/argocd/
├── app-of-apps.yaml          # bootstrap: cria os Applications abaixo
└── applications/
    ├── infra-prometheus.yaml
    ├── infra-postgres.yaml
    ├── infra-redis.yaml
    ├── infra-nats.yaml
    ├── pickstack-auth.yaml
    ├── pickstack-gateway.yaml
    ├── pickstack-focus.yaml
    ├── pickstack-cards.yaml
    ├── pickstack-trilha.yaml
    └── pickstack-web.yaml
```

Sync waves:
- wave 0: namespaces, RBAC
- wave 1: storage classes, CRDs
- wave 2: datastores (postgres, redis, nats)
- wave 3: auth-svc (outros dependem dele)
- wave 4: módulos
- wave 5: gateway
- wave 6: web

---

## 8. Decisões registradas (ADR-lite)

| # | Decisão | Razão |
|---|---|---|
| 1 | Deno + Hono | Reaproveita stack do MESA; ótimo Dockerfile; std lib forte |
| 2 | SvelteKit | DX leve, SSR opcional, sem framework "pesado" para o aluno aprender |
| 3 | Drizzle ORM (não Prisma) | Tipo-seguro em Deno, sem geração de código pesada |
| 4 | NATS (não Kafka) | Curva de aprendizado menor; JetStream cobre persistência |
| 5 | Helm + Kustomize overlays | Helm para template, Kustomize para overlays de env |
| 6 | Postgres em StatefulSet | Pedagógico (PVC, storage class); pode trocar por managed em SaaS |
| 7 | 1 schema por serviço | Isolamento sem custo de múltiplos clusters DB |
| 8 | Eventos via NATS, não HTTP entre módulos | Reduz acoplamento; força pensar em eventual consistency |

---

## 9. Não-objetivos (no MVP)

- Multi-cluster federado (fica para depois do PICK).
- Service mesh (Istio/Linkerd) — opcional como exercício avançado, não core.
- Backup automatizado de Postgres — exercício do mês CKA.
- WebRTC / videochamada — fora de escopo.
- Pagamento Stripe — só skeleton, sem integração real até virar SaaS de verdade.
