# Contrato de Módulo do PICKStack

Como adicionar um módulo novo (ex: `journal-svc`, `simulados-svc`) ao PICKStack. Use isso como referência ao trabalhar no Mês 11 do PICK ou ao contribuir um módulo upstream.

---

## 1. Princípios

Um **módulo** no PICKStack é:
- Um microsserviço independente em `services/<nome>-svc/`.
- Tem seu próprio schema no Postgres compartilhado.
- Expõe HTTP atrás do `api-gateway`.
- Publica métricas Prometheus.
- Publica eventos de domínio em NATS quando algo importante acontece (sem esperar consumidor).
- Pode opcionalmente ter UI no `web/` (rota nova em `(app)/<modulo>`).
- Tem Helm chart próprio + ArgoCD Application.

Módulos **não** se chamam por HTTP — usam eventos. Excepcionalmente, podem consultar `auth-svc` para enriquecer dados (com cache).

---

## 2. Estrutura mínima

```
services/<nome>-svc/
├── deno.json
├── src/
│   ├── main.ts
│   ├── app.ts                  # Hono app factory
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema
│   │   ├── client.ts
│   │   └── migrations/
│   │       └── 0001_init.sql
│   ├── handlers/               # 1 arquivo por recurso
│   ├── lib/
│   │   ├── prom.ts             # métricas Prometheus
│   │   └── events.ts           # publish NATS
│   └── middleware/
│       └── auth.ts             # lê x-user-id, x-tenant-id
├── tests/
├── Dockerfile                  # multi-stage
├── .env.example
└── README.md
```

---

## 3. Endpoints obrigatórios

Todo módulo expõe:

| Método | Path | O que retorna |
|---|---|---|
| GET | `/healthz` | 200 `{"status":"healthy"}` se o processo está vivo |
| GET | `/readyz` | 200 se DB + dependências OK; 503 com `{checks: {...}}` se algo falhou |
| GET | `/metrics` | Prometheus format (text/plain) |

---

## 4. Convenções de API

- **Sem prefixo** `/api/<modulo>` — o gateway adiciona. Você expõe `/sessions`, não `/api/focus/sessions`.
- **JSON request/response.** `Content-Type: application/json`.
- **Erros padronizados:** `{"error": "mensagem humana", "code": "ERRO_MAQUINA"}` com status HTTP apropriado:
  - 400 — validação
  - 401 — sem auth (geralmente o gateway pega antes)
  - 403 — sem permissão
  - 404 — recurso não existe
  - 409 — conflito (ex: nome duplicado)
  - 422 — semântica inválida
  - 500 — erro do servidor (logar stack)
- **Listagens paginadas:** `?limit=20&offset=0`, resposta `{items: [...], total, limit, offset}`.
- **IDs:** sempre UUID v4. Banco gera com `gen_random_uuid()`.

---

## 5. Multi-tenancy (obrigatório)

Toda tabela de domínio tem `tenant_id UUID NOT NULL`. Todo query filtra:

```sql
SELECT ... WHERE tenant_id = $1 AND ...
```

Esquecer essa cláusula em qualquer query é **bug crítico** (vazamento entre tenants). Adicione teste que falha se vier dado de outro tenant.

Os headers `x-user-id` e `x-tenant-id` são injetados pelo `api-gateway` após validar o JWT. Seu módulo confia neles — não revalida JWT.

---

## 6. Schema Postgres

- Cada módulo usa um **schema** dedicado no banco compartilhado (`focus`, `cards`, `trilha`, `journal`, …).
- Schema criado pelo `infra/docker/postgres-init.sql`. Para adicionar novo módulo, edite esse script.
- Migrations em `src/db/migrations/`, numeradas (`0001_init.sql`, `0002_add_foo.sql`). Idempotentes (`CREATE TABLE IF NOT EXISTS`).
- Migrations rodam via `Job` Helm com hook `pre-install`/`pre-upgrade`.

---

## 7. Eventos NATS

**Quando publicar:** sempre que algo de domínio importante acontecer (criação, conclusão, exclusão).

**Convenção de subject:**
```
<modulo>.<recurso>.<acao>
```

Exemplos:
- `focus.session.started`
- `focus.session.completed`
- `cards.review.done`
- `trilha.node.completed`

**Payload:** JSON com campos `event_id`, `occurred_at`, `tenant_id`, `user_id`, e payload do evento.

```json
{
  "event_id": "uuid",
  "event_type": "focus.session.completed",
  "occurred_at": "2026-05-16T13:00:00Z",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "data": { "session_id": "uuid", "duration_s": 1500, "type": "pomodoro" }
}
```

JetStream stream sugerida por módulo: `<modulo>` (ex: `focus`, `cards`). Retention: 7d.

---

## 8. Observability

### Métricas obrigatórias

Implemente em `src/lib/prom.ts`:

```typescript
// HTTP
http_requests_total{method,route,status}   // counter
http_request_duration_seconds{method,route} // histogram

// Domínio (exemplo de focus)
focus_sessions_started_total{type}
focus_sessions_completed_total{type}
focus_session_duration_seconds{type}        // histogram
```

### Logs

JSON estruturado em stdout. Campos mínimos:

```
ts (ISO 8601)
level (debug|info|warn|error)
service (focus-svc)
request_id (correlation id, vem do header x-request-id ou gera novo)
msg
... (campos contextuais)
```

### Traces

OpenTelemetry SDK (`npm:@opentelemetry/api` + auto-instrumentations). Configure exportador OTLP para o endpoint do Tempo.

---

## 9. Helm chart

Crie em `infra/helm/charts/<modulo>-svc/` seguindo o template dos charts existentes. Mínimo:

- `Chart.yaml` (versão sincronizada com o serviço)
- `values.yaml`:
  - `image.repository`, `image.tag`
  - `replicaCount` (default 2)
  - `resources` (req 100m/256Mi, lim 500m/512Mi)
  - `service.port`
  - `metrics.enabled`
  - `database.schema`
- `templates/`:
  - `deployment.yaml` (com probes)
  - `service.yaml`
  - `configmap.yaml`
  - `servicemonitor.yaml` (atrás de `if .Values.metrics.enabled`)
  - `migration-job.yaml` (Helm hook `pre-install,pre-upgrade`)
  - `NOTES.txt`

---

## 10. ArgoCD Application

Adicione `infra/argocd/applications/NN-pickstack-<modulo>.yaml` (numeração indica wave). Inclua no app-of-apps automaticamente se o `applications/` for um `ApplicationSet` (verifique a config atual).

Sync wave sugerida:
- Módulos puros (sem dependência cruzada): wave 3
- Se depende de outro módulo: wave 4

---

## 11. Frontend (opcional)

Se o módulo tem UI:
- Crie rotas em `web/src/routes/(app)/<modulo>/`.
- Cliente em `web/src/lib/api/<modulo>.ts`.
- Componentes em `web/src/lib/components/<Nome>.svelte`.
- Adicione entrada no `Sidebar.svelte`.

---

## 12. Testes

- **Unitários:** lógica pura (ex: algoritmo SM-2 em cards, cálculo de streak em focus). Sem DB.
- **Integração:** API + DB real (Postgres em container via testcontainers ou `infra/docker-compose.test.yml`). Testes que exercitam endpoint → handler → DB → assert.
- **Multi-tenant:** teste explícito que comprova isolation (criar dois tenants, ver que A não vê dados de B).
- **Mínimo:** 1 happy path por endpoint público + os testes de multi-tenant.

---

## 13. Documentação do módulo

`README.md` do serviço com:
- O que faz (1 parágrafo)
- Tabela de endpoints
- Tabela de env vars
- Como rodar local (`deno task dev`)
- Como rodar testes
- Como adicionar uma migration
- Eventos NATS publicados (subject + payload schema)
- Links: dashboard Grafana, ServiceMonitor, runbook

---

## 14. Checklist pre-merge

Antes de abrir PR para o upstream:

- [ ] `/healthz`, `/readyz`, `/metrics` implementados
- [ ] Todo query filtra `tenant_id`
- [ ] Headers `x-user-id` e `x-tenant-id` validados em todo endpoint protegido
- [ ] Erros seguem o padrão `{error, code}`
- [ ] Métricas Prometheus exportadas
- [ ] Logs JSON estruturados
- [ ] Dockerfile multi-stage, imagem ≤ 100MB se possível
- [ ] Helm chart com probes corretos
- [ ] Migration idempotente
- [ ] ServiceMonitor template incluído
- [ ] Testes: pelo menos 1 happy path por endpoint + teste de multi-tenant
- [ ] README atualizado
- [ ] `docs/ARCHITECTURE.md` atualizado se introduziu padrão novo
- [ ] Sem `console.log` no código (usar logger)
- [ ] Sem secrets hardcoded
- [ ] Eventos NATS publicados nos pontos relevantes

---

## 15. Anti-patterns

Coisas que **não** fazer em módulos:

- **Chamadas HTTP entre módulos.** Use eventos. Exceção: ler `auth-svc` para enriquecer (com cache 60s).
- **Compartilhar tabela com outro módulo.** Se dois módulos precisam dos mesmos dados, eles têm cópias mantidas via eventos.
- **Joins cross-schema.** É possível tecnicamente mas quebra o isolamento. Use eventos.
- **Variável global pra estado.** Mesmo "cache em memória" deve ter TTL e tamanho máximo (use `lru-cache` ou similar).
- **`SELECT *` em produção.** Liste colunas explicitamente.
- **Migrations não-idempotentes.** Sempre `IF NOT EXISTS` / `IF EXISTS`.
- **Mensagens de erro vazadas pro cliente** com detalhes internos (path do banco, stack trace). Logue completo, retorne curto.
- **Tarefas longas no path de request.** Use NATS pra disparar worker.

---

**Quando em dúvida, leia os 3 módulos existentes (focus, cards, trilha) — eles são a referência viva deste contrato.**
