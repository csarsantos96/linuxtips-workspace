---
name: 🧩 Proposta de módulo novo
about: Sugerir um novo módulo no PICKStack (ex: journal, simulados, comunidade)
title: "[módulo] "
labels: ["module-proposal", "mes-11"]
assignees: []
---

> Antes de abrir, leia [docs/MODULE-CONTRACT.md](../../docs/MODULE-CONTRACT.md). Todo módulo precisa seguir esse contrato.

## Nome proposto

`<nome>-svc` (ex: `journal-svc`)

## Problema que resolve

<!-- Para qual estudante isso é útil? Qual buraco preenche entre os módulos existentes? -->

## Escopo do MVP

Endpoints públicos:
- `POST /...`
- `GET /...`

Schema Postgres (esboço):
```sql
CREATE TABLE <modulo>.<recurso> (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  ...
);
```

Eventos NATS que publica:
- `<modulo>.<recurso>.<acao>`

Eventos NATS que consome (se houver):
- `<outro_modulo>.<recurso>.<acao>` → o que faz com ele

## Frontend

- [ ] Sim, com rota nova `(app)/<modulo>`
- [ ] Não, headless por enquanto

## Dependências

- Outros módulos que precisam existir antes?
- Bibliotecas externas (justificar):

## Plano de entrega

- [ ] PR 1: schema + handlers + Dockerfile
- [ ] PR 2: Helm chart + ServiceMonitor
- [ ] PR 3: ArgoCD Application + sync wave
- [ ] PR 4: frontend (se aplicável)
- [ ] PR 5: dashboard Grafana + alerta + runbook

## Por que isso é didático

<!-- Que conceito do PICK isso ajuda a praticar? -->
