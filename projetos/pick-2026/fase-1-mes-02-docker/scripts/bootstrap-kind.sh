#!/usr/bin/env bash
# bootstrap-kind.sh — sobe um cluster kind local e instala o PICKStack.
#
# Uso:
#   ./scripts/bootstrap-kind.sh [cluster-name]
#
# Default cluster-name: pickstack
#
# Pré-requisitos (verificados abaixo): docker, kind, kubectl, helm.

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CLUSTER_NAME="${1:-pickstack}"
NAMESPACE="pickstack"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELM_CHART_DIR="${REPO_ROOT}/infra/helm/pickstack"
VALUES_DEV="${HELM_CHART_DIR}/values-dev.yaml"
INGRESS_NS="ingress-nginx"
INGRESS_NGINX_VERSION="${INGRESS_NGINX_VERSION:-4.11.3}"

# Cores (só se TTY).
if [[ -t 1 ]]; then
  BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"
  RED="$(printf '\033[31m')"; GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"; BLUE="$(printf '\033[34m')"
  RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

log()  { echo "${BLUE}==>${RESET} ${BOLD}$*${RESET}"; }
ok()   { echo "${GREEN}✓${RESET} $*"; }
warn() { echo "${YELLOW}!${RESET} $*" >&2; }
err()  { echo "${RED}✗${RESET} $*" >&2; }

# ---------------------------------------------------------------------------
# Cleanup em erro
# ---------------------------------------------------------------------------

CLEANUP_ON_ERROR=true
cleanup_on_error() {
  local rc=$?
  if [[ $rc -ne 0 && "$CLEANUP_ON_ERROR" == "true" ]]; then
    err "bootstrap falhou (rc=$rc). Para limpar:  ./scripts/teardown-kind.sh ${CLUSTER_NAME}"
  fi
  exit $rc
}
trap cleanup_on_error EXIT

# ---------------------------------------------------------------------------
# 1. Pré-requisitos
# ---------------------------------------------------------------------------

log "Verificando ferramentas necessárias"
missing=()
for bin in docker kind kubectl helm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    missing+=("$bin")
  fi
done
if (( ${#missing[@]} > 0 )); then
  err "Faltam: ${missing[*]}"
  echo
  echo "Instale com (macOS / Homebrew):"
  echo "  brew install ${missing[*]}"
  echo
  echo "Ou veja:"
  echo "  - docker:  https://docs.docker.com/get-docker/"
  echo "  - kind:    https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  echo "  - kubectl: https://kubernetes.io/docs/tasks/tools/"
  echo "  - helm:    https://helm.sh/docs/intro/install/"
  exit 1
fi
ok "docker, kind, kubectl, helm encontrados"

if ! docker info >/dev/null 2>&1; then
  err "Docker não está rodando. Inicie o Docker Desktop / dockerd antes."
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Cluster kind
# ---------------------------------------------------------------------------

if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  ok "Cluster kind '${CLUSTER_NAME}' já existe — reaproveitando"
else
  log "Criando cluster kind '${CLUSTER_NAME}' com portmappings 80/443/30000-30100"
  KIND_CONFIG="$(mktemp -t pickstack-kind-XXXXXX.yaml)"
  cat >"${KIND_CONFIG}" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ${CLUSTER_NAME}
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
      - containerPort: 30000
        hostPort: 30000
        protocol: TCP
      - containerPort: 30100
        hostPort: 30100
        protocol: TCP
EOF
  kind create cluster --config "${KIND_CONFIG}"
  rm -f "${KIND_CONFIG}"
  ok "Cluster '${CLUSTER_NAME}' criado"
fi

# Garante contexto correto.
kubectl config use-context "kind-${CLUSTER_NAME}" >/dev/null

# ---------------------------------------------------------------------------
# 3. Aguarda nodes Ready
# ---------------------------------------------------------------------------

log "Aguardando node(s) ficarem Ready"
kubectl wait --for=condition=Ready node --all --timeout=180s
ok "Nodes prontos"

# ---------------------------------------------------------------------------
# 4. ingress-nginx
# ---------------------------------------------------------------------------

log "Instalando ingress-nginx (chart oficial kubernetes.github.io/ingress-nginx)"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update >/dev/null

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace "${INGRESS_NS}" --create-namespace \
  --version "${INGRESS_NGINX_VERSION}" \
  --set controller.hostPort.enabled=true \
  --set controller.service.type=NodePort \
  --set controller.nodeSelector."ingress-ready"=true \
  --set controller.tolerations[0].key="node-role.kubernetes.io/control-plane" \
  --set controller.tolerations[0].operator=Exists \
  --set controller.tolerations[0].effect=NoSchedule \
  --set controller.admissionWebhooks.enabled=false \
  --wait --timeout 5m
ok "ingress-nginx pronto em ${INGRESS_NS}"

# ---------------------------------------------------------------------------
# 5. Namespace + secret pickstack-credentials
# ---------------------------------------------------------------------------

log "Criando namespace '${NAMESPACE}' e secret pickstack-credentials"
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Secret com URLs internas. JWT_SECRET aqui é dev-only; em produção use ESO/SealedSecrets.
kubectl -n "${NAMESPACE}" create secret generic pickstack-credentials \
  --from-literal=DATABASE_URL="postgres://pickstack:pickstack-dev@pickstack-postgresql:5432/pickstack" \
  --from-literal=REDIS_URL="redis://pickstack-redis-master:6379" \
  --from-literal=NATS_URL="nats://pickstack-nats:4222" \
  --from-literal=JWT_SECRET="dev-only-jwt-secret-change-me" \
  --from-literal=JWT_PUBLIC_KEY="dev-only-jwt-public-key" \
  --dry-run=client -o yaml | kubectl apply -f -
ok "Secret pickstack-credentials aplicado"

# ---------------------------------------------------------------------------
# 6. helm dependency update
# ---------------------------------------------------------------------------

log "Atualizando dependências do umbrella (Bitnami)"
helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
helm repo update >/dev/null
helm dependency update "${HELM_CHART_DIR}"
ok "Dependencies atualizadas"

# ---------------------------------------------------------------------------
# 7. Instalar PICKStack
# ---------------------------------------------------------------------------

log "Instalando PICKStack (umbrella) — pode demorar alguns minutos"
if ! helm upgrade --install pickstack "${HELM_CHART_DIR}" \
    --namespace "${NAMESPACE}" \
    -f "${HELM_CHART_DIR}/values.yaml" \
    -f "${VALUES_DEV}" \
    --wait --timeout 10m; then
  err "helm upgrade falhou. Veja: kubectl get pods -n ${NAMESPACE}"
  exit 1
fi
ok "PICKStack instalado"

# ---------------------------------------------------------------------------
# 8. Resumo
# ---------------------------------------------------------------------------

CLEANUP_ON_ERROR=false  # daqui pra frente é só exibir info, qualquer falha é cosmética.

echo
echo "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════════╗${RESET}"
echo "${BOLD}${GREEN}║                  PICKStack pronto no kind                        ║${RESET}"
echo "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════════╝${RESET}"
echo
echo "${BOLD}Pods:${RESET}"
kubectl get pods -n "${NAMESPACE}"
echo
echo "${BOLD}Ingress:${RESET}"
kubectl get ingress -n "${NAMESPACE}" 2>/dev/null || true
echo
echo "${BOLD}URLs (após editar /etc/hosts):${RESET}"
echo "  - Web:        http://pickstack.local"
echo "  - API:        http://api.pickstack.local"
echo
echo "${BOLD}/etc/hosts:${RESET}"
echo "  echo '127.0.0.1 pickstack.local api.pickstack.local' | sudo tee -a /etc/hosts"
echo
echo "${BOLD}Credenciais default (dev):${RESET}"
echo "  Postgres: pickstack / pickstack-dev"
echo "  Redis:    sem auth"
echo "  ${YELLOW}NUNCA use essas credenciais em produção.${RESET}"
echo
echo "${BOLD}Limpeza:${RESET}  ./scripts/teardown-kind.sh ${CLUSTER_NAME}"
echo
