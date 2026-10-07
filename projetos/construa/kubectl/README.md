# Construa: kubectl (mkube)

Bem-vindo ao projeto **Construa** `kubectl`. Você vai construir do zero,
em Go, uma reimplementacao do `kubectl` — o CLI canonico do Kubernetes.

Cada stage e' um passo independente que adiciona uma capacidade. Quando
você passa de stage, ganha XP, atualiza a EVIDENCIAS.md e segue pro
proximo. Sem atalho, sem cola — você constroi com as proprias maos.

## Stages

1. **setup** — Imprime versão com `mkube version`.
2. **kubeconfig** — Le e parsea ~/.kube/config.
3. **contextos** — Lista e troca de contexto.
4. **cluster** — Conecta no API server via REST.
5. **autenticacao** — Bearer token / client cert / exec plugin.
6. **get** — Lista pods, deployments, services em formato tabela.
7. **describe** — Detalhes de um recurso (events, conditions, status).
8. **logs** — Stream de logs de um pod, com -f e --tail.
9. **exec** — Executa comando dentro de container (SPDY/WebSocket).
10. **apply** — Aplica manifest YAML (strategic merge patch).
11. **watch** — Stream de eventos com `kubectl get -w`.
12. **port-forward** — Tunel local pra porta do pod.

## Como rodar local

```bash
go build -o mkube .
./mkube version
```

## Estrutura do projeto

```
projetos/construa/kubectl/
  README.md
  EVIDENCIAS.md
  go.mod
  main.go
  internal/
    version/
      version.go
```

## Fluxo de submit

1. Você implementa o stage atual.
2. Commit no branch `construa/kubectl` do repo `csarsantos96/linuxtips-workspace`.
3. Push pro GitHub.
4. No widget Construa da sala de aula, clique em **Submeter stage**.
5. O MESA roda os testes oficiais contra o seu codigo num pod isolado.
6. Se passar: XP creditado, EVIDENCIAS.md atualizado, proximo stage liberado.
7. Se falhar: o relatorio da IA aparece no widget com pistas (sem dar a
   resposta) e você tenta de novo.

## Regras

- Você não precisa usar bibliotecas oficiais do Kubernetes (`client-go`).
  O ponto e' entender como o `kubectl` funciona por dentro.
- Stdlib do Go + qualquer dep que você ache util.
- Codigo precisa ser **seu**. Copy-paste de IA ou de outro projeto
  Construa e' detectado pelo agente de code review.

Bons builds.
