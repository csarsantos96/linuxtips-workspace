# PICKStack — ArgoCD Bootstrap

GitOps via padrão **app-of-apps**: você aplica **um único** `Application`
(`app-of-apps.yaml`) e o ArgoCD descobre/sincroniza todas as outras Applications
em `applications/`.

## Estrutura

```
infra/argocd/
├── app-of-apps.yaml              # único arquivo aplicado manualmente
└── applications/
    ├── 01-infra-postgres.yaml      # sync-wave 1 (datastores)
    ├── 02-infra-redis.yaml         # sync-wave 1
    ├── 03-infra-nats.yaml          # sync-wave 1
    ├── 10-pickstack-auth.yaml      # sync-wave 2 (auth primeiro)
    ├── 11-pickstack-focus.yaml     # sync-wave 3 (módulos)
    ├── 12-pickstack-cards.yaml     # sync-wave 3
    ├── 13-pickstack-trilha.yaml    # sync-wave 3
    ├── 20-pickstack-gateway.yaml   # sync-wave 4 (gateway depois dos módulos)
    └── 30-pickstack-web.yaml       # sync-wave 5 (frontend por último)
```

## Sync waves

| Wave | Componentes | Por quê |
|---|---|---|
| 1 | postgres, redis, nats | Datastores precisam estar prontos antes dos serviços |
| 2 | auth-svc | Outros módulos dependem de JWT |
| 3 | focus-svc, cards-svc, trilha-svc | Independentes entre si, mas dependem de auth |
| 4 | api-gateway | Precisa dos módulos atrás dele |
| 5 | web | Frontend depende do gateway |

## Pré-requisitos

1. Cluster Kubernetes 1.27+
2. ArgoCD 2.10+ instalado em `argocd`
3. Credenciais Git configuradas (o repo é **privado**)
4. Namespace `pickstack` (será criado automaticamente pelas Apps com `CreateNamespace=true`)
5. Secrets das aplicações já provisionados (via SealedSecrets, ExternalSecrets ou `kubectl create secret`):
   - `pickstack-auth-secrets`
   - `pickstack-focus-secrets`
   - `pickstack-cards-secrets`
   - `pickstack-trilha-secrets`
   - `pickstack-gateway-secrets`
   - `pickstack-postgres-auth` (consumido pelo chart bitnami)

## Configurar credencial Git (repo privado)

Crie um Secret no namespace `argocd` (substitua `<TOKEN>` por um PAT do GitHub
com escopo `repo`):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: pickstack-repo-creds
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  type: git
  url: https://github.com/linuxtips/pickstack
  password: <TOKEN>
  username: not-used   # PAT vai no campo password
```

Ou via CLI:

```bash
argocd repo add https://github.com/linuxtips/pickstack \
  --username <user> --password <TOKEN>
```

## Bootstrap

```bash
# 1) Aplicar o app-of-apps (uma única vez)
kubectl apply -n argocd -f infra/argocd/app-of-apps.yaml

# 2) Acompanhar o sync
argocd app list
argocd app get pickstack-bootstrap
argocd app sync pickstack-bootstrap   # opcional, automated.selfHeal já faz
```

A partir daí, **toda mudança em `infra/argocd/applications/` ou nos charts
(`infra/helm/`) é sincronizada automaticamente** pelo ArgoCD ao fazer push para
`main`.

## Rollback

```bash
argocd app history pickstack-focus-svc
argocd app rollback pickstack-focus-svc <revision-id>
```

## Limpar tudo

```bash
kubectl delete -n argocd -f infra/argocd/app-of-apps.yaml
# Os finalizers garantem que recursos filhos sejam removidos.
```
