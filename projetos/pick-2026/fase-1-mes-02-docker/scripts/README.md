# PICKStack — scripts

Utilitários de automação. Tudo aqui é idempotente — pode rodar várias vezes.

| Script | O que faz |
|---|---|
| [`bootstrap-kind.sh`](./bootstrap-kind.sh) | Sobe um cluster `kind` local, instala `ingress-nginx`, cria o namespace `pickstack` + secret `pickstack-credentials`, atualiza deps Helm e instala o umbrella com `values-dev.yaml`. |
| [`teardown-kind.sh`](./teardown-kind.sh) | Deleta o cluster `kind` criado pelo script anterior. |

## Pré-requisitos comuns

- `docker`
- `kind`     (https://kind.sigs.k8s.io)
- `kubectl`  (https://kubernetes.io/docs/tasks/tools/)
- `helm`     (https://helm.sh)

No macOS: `brew install docker kind kubectl helm` (Docker Desktop também serve).

## Tornar executável (uma vez)

```bash
chmod +x scripts/*.sh
```

## Uso típico

```bash
# Sobe tudo
./scripts/bootstrap-kind.sh
# ou
make kind-up

# (depois) derruba tudo
./scripts/teardown-kind.sh
# ou
make kind-down
```

O nome do cluster é configurável: `./scripts/bootstrap-kind.sh meu-cluster`.

## Variáveis de ambiente

| Var | Default | Onde |
|---|---|---|
| `INGRESS_NGINX_VERSION` | `4.11.3` | `bootstrap-kind.sh` — versão do chart `ingress-nginx/ingress-nginx`. |

## /etc/hosts

Para acessar os ingresses via `pickstack.local` / `api.pickstack.local`:

```bash
echo "127.0.0.1 pickstack.local api.pickstack.local" | sudo tee -a /etc/hosts
```
