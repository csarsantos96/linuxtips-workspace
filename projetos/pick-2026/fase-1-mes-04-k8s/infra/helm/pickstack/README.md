# PICKStack — Umbrella Chart

Chart Helm que agrega tudo num único release: datastores (Postgres, Redis, NATS
— via charts oficiais Bitnami) + os 6 charts internos do PICKStack
(`auth-svc`, `api-gateway`, `focus-svc`, `cards-svc`, `trilha-svc`, `web`).

> O umbrella é a forma **mais rápida** de subir tudo localmente. Em
> produção, usamos ArgoCD com 1 `Application` por componente — veja
> [`infra/argocd/`](../../argocd).

## Estrutura

```
infra/helm/
├── pickstack/                 # este chart (umbrella)
│   ├── Chart.yaml
│   ├── Chart.lock             # gerado por `helm dependency update`
│   ├── values.yaml            # defaults (compartilhados)
│   ├── values-dev.yaml        # overrides para kind/lab local
│   ├── templates/
│   │   └── _helpers.tpl
│   └── charts/                # tarballs baixados pelo helm dep update
└── charts/
    ├── auth-svc/
    ├── api-gateway/
    ├── focus-svc/
    ├── cards-svc/
    ├── trilha-svc/
    └── web/
```

## Pré-requisitos

- Helm 3.12+
- Kubernetes 1.27+
- Acesso a `https://charts.bitnami.com/bitnami` (para baixar PostgreSQL / Redis / NATS)
- Ingress controller (NGINX) se habilitar `ingress.enabled` em `values-dev.yaml`

## Valores principais

| Chave | Default | O quê |
|---|---|---|
| `postgresql.enabled` | `true` | Sobe Postgres bitnami (StatefulSet). |
| `postgresql.auth.username` | `pickstack` | Usuário da aplicação. |
| `postgresql.auth.password` | `pickstack-dev` | **Altere em produção** — use ESO/SealedSecrets. |
| `postgresql.primary.initdb.scripts` | inline SQL | Cria schemas `auth/focus/cards/trilha` no 1º boot. |
| `redis.enabled` | `true` | Sobe Redis bitnami (standalone). |
| `redis.auth.enabled` | `false` | Em produção, habilite. |
| `nats.enabled` | `true` | NATS com JetStream, 1 réplica. |
| `<svc>.enabled` | `true` | Liga/desliga sub-chart individual. |
| `<svc>.image.repository` | `ghcr.io/linuxtips/pickstack-<svc>` | Será sobrescrito pelo image-updater do ArgoCD. |
| `<svc>.secretRef.name` | `pickstack-credentials` | Secret criado fora do chart (ver `scripts/bootstrap-kind.sh`). |
| `api-gateway.ingress.enabled` | `false` em prod / `true` em dev | Em dev expõe `api.pickstack.local`. |
| `web.ingress.enabled` | `false` em prod / `true` em dev | Em dev expõe `pickstack.local`. |

## Instalando em kind local (caminho rápido)

```bash
# Da raiz do repo:
make kind-up
# ou diretamente:
./scripts/bootstrap-kind.sh
```

O script cria o cluster kind, instala nginx-ingress, cria o secret
`pickstack-credentials` e instala o umbrella com `values-dev.yaml`.

Não esqueça de mapear os hosts:

```
echo "127.0.0.1 pickstack.local api.pickstack.local" | sudo tee -a /etc/hosts
```

## Instalando manualmente

```bash
# 1. Baixar dependências (Postgres/Redis/NATS Bitnami).
helm dependency update infra/helm/pickstack

# 2. Criar namespace.
kubectl create namespace pickstack

# 3. Criar secret de credenciais (DEV — em prod use ESO/SealedSecrets).
kubectl -n pickstack create secret generic pickstack-credentials \
  --from-literal=DATABASE_URL="postgres://pickstack:pickstack-dev@pickstack-postgresql:5432/pickstack" \
  --from-literal=REDIS_URL="redis://pickstack-redis-master:6379" \
  --from-literal=NATS_URL="nats://pickstack-nats:4222" \
  --from-literal=JWT_SECRET="dev-only-jwt-secret-change-me" \
  --from-literal=JWT_PUBLIC_KEY="dev-only-jwt-public-key"

# 4. Instalar.
helm upgrade --install pickstack infra/helm/pickstack \
  --namespace pickstack \
  -f infra/helm/pickstack/values.yaml \
  -f infra/helm/pickstack/values-dev.yaml \
  --wait --timeout 10m
```

## Instalando em cluster real

```bash
helm upgrade --install pickstack infra/helm/pickstack \
  --namespace pickstack --create-namespace \
  -f infra/helm/pickstack/values.yaml \
  -f infra/helm/pickstack/values-prod.yaml \
  --set postgresql.auth.password=$(openssl rand -hex 16) \
  --set postgresql.auth.postgresPassword=$(openssl rand -hex 16) \
  --wait --timeout 15m
```

Crie um `values-prod.yaml` próprio. Pontos importantes:

1. **NÃO use** os defaults de senha (`pickstack-dev`). Passe via `--set` /
   secret externo / External Secrets Operator.
2. Habilite `redis.auth.enabled=true` e configure senha.
3. Aumente `replicaCount` e `persistence.size` conforme necessidade.
4. Habilite `metrics.enabled=true` em cada sub-chart (precisa do
   kube-prometheus-stack instalado para `ServiceMonitor`).
5. Configure `ingress.tls` com cert-manager.

## Validação local

```bash
# Atualiza deps.
helm dependency update infra/helm/pickstack

# Lint.
helm lint infra/helm/pickstack

# Render completo.
helm template pickstack infra/helm/pickstack \
  -f infra/helm/pickstack/values.yaml \
  -f infra/helm/pickstack/values-dev.yaml \
  > /tmp/rendered.yaml
```

`make helm-deps`, `make helm-lint` e `make helm-template` rodam esses passos.

## Gerando o `Chart.lock`

`Chart.lock` **não é commitado** neste repositório — ele é gerado
localmente pelo `helm dependency update`. Em CI, o passo `make helm-deps`
roda antes de qualquer `helm install/template`.

> Por que? Em monorepo pedagógico, evitamos commitar tarballs binários
> (vão para `infra/helm/pickstack/charts/`) e o lock de versão fica em
> `Chart.yaml` via `version: "x.y.z"` (pinning explícito).

Se você precisa um build determinístico em CI sem acesso a `charts.bitnami.com`,
gere o lock e os tarballs uma vez e versione em diretório separado:

```bash
helm dependency update infra/helm/pickstack
git add -f infra/helm/pickstack/Chart.lock
# (opcional) git add -f infra/helm/pickstack/charts/*.tgz
```

## Troubleshooting

### `helm dependency update` falha
- Verifique conectividade com `https://charts.bitnami.com/bitnami`.
- Cheque versões em `Chart.yaml` — versões Bitnami são removidas/renumeradas
  com frequência. Procure a mais próxima em
  https://artifacthub.io/packages/helm/bitnami/postgresql

### Postgres sobe mas schemas não existem
- O bloco `primary.initdb.scripts` em `values.yaml` SÓ roda no primeiro
  boot (PVC vazio). Se você instalou antes sem o initdb, delete o PVC:
  ```bash
  kubectl -n pickstack delete pvc data-pickstack-postgresql-0
  kubectl -n pickstack rollout restart statefulset pickstack-postgresql
  ```
- Ou aplique manualmente: `kubectl -n pickstack exec -it pickstack-postgresql-0 -- psql -U pickstack -d pickstack -f /docker-entrypoint-initdb.d/01-schemas.sql`

### Ingress retorna 404
- Verifique que o ingress-nginx subiu: `kubectl -n ingress-nginx get pods`.
- Confira `kubectl get ingress -n pickstack` — host deve bater com o que
  você colocou em `/etc/hosts`.
- Em kind: os portmappings (80/443) devem estar no `kind-config.yaml`
  — o `bootstrap-kind.sh` já cuida disso.

### Pods em `ImagePullBackOff`
- As imagens `ghcr.io/linuxtips/pickstack-<svc>:0.1.0` são **placeholders**
  até o CI publicar. Para dev rápido, faça o build local + `kind load
  docker-image`:
  ```bash
  docker build -t ghcr.io/linuxtips/pickstack-auth-svc:0.1.0 services/auth-svc
  kind load docker-image ghcr.io/linuxtips/pickstack-auth-svc:0.1.0 --name pickstack
  ```
