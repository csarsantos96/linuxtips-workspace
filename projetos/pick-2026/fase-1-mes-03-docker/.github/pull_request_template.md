<!-- Obrigado por contribuir com o PICKStack. Esse template é didático: ele cobra o mínimo que esperamos de um PR profissional no PICK 2026. -->

## O que muda

<!-- 1-2 parágrafos descrevendo a mudança e o porquê. -->

## Issue relacionada

Closes #

## Tipo de mudança

- [ ] 🐛 Bug fix
- [ ] ✨ Feature nova
- [ ] 🧩 Módulo novo (seguindo MODULE-CONTRACT.md)
- [ ] 📓 Runbook / documentação
- [ ] ♻️ Refactor sem mudança de comportamento
- [ ] 🚀 Performance
- [ ] 🔒 Segurança

## Checklist obrigatório

- [ ] Multi-tenancy: toda nova query filtra `tenant_id`
- [ ] Headers `x-user-id` e `x-tenant-id` validados em endpoints protegidos
- [ ] Erros seguem `{error, code}` com status HTTP apropriado
- [ ] Métricas Prometheus emitidas (se rota nova)
- [ ] Logs JSON estruturados (sem `console.log`)
- [ ] Probes `/healthz` e `/readyz` continuam respondendo corretamente
- [ ] Migration idempotente (`IF NOT EXISTS`/`IF EXISTS`)
- [ ] Testes adicionados (ao menos 1 happy path)
- [ ] README do serviço atualizado (se rota mudou)
- [ ] Sem secrets hardcoded

## Breaking change?

- [ ] Não
- [ ] Sim — documente abaixo o que quebra e como migrar:

<!-- explique aqui -->

## Como testei

<!-- Comandos exatos. Outputs colados quando relevante. -->

```bash
# ...
```

## Screenshots / demo (se frontend)

<!-- arrastar imagens ou colar GIF -->

## Notas para o reviewer

<!-- Algo que você quer destaque na revisão? -->
