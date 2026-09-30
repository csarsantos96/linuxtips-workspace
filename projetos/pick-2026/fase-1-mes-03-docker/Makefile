# PICKStack — atalhos de desenvolvimento.
# Rode `make help` para ver tudo.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

COMPOSE_FILE := infra/docker-compose.dev.yml
HELM_CHART   := infra/helm/pickstack
HELM_VALUES  := $(HELM_CHART)/values.yaml
HELM_VALUES_DEV := $(HELM_CHART)/values-dev.yaml
RENDERED     := /tmp/rendered.yaml

SERVICES := auth-svc api-gateway focus-svc cards-svc trilha-svc

# Cores
B := \033[1m
D := \033[2m
G := \033[32m
Y := \033[33m
R := \033[0m

##@ Dev local (docker compose)

.PHONY: dev
dev: ## Sobe só os datastores (postgres, redis, nats, minio)
	docker compose -f $(COMPOSE_FILE) --profile infra up -d

.PHONY: dev-full
dev-full: ## Sobe datastores + microsserviços + frontend web
	docker compose -f $(COMPOSE_FILE) --profile services --profile web up -d

.PHONY: dev-down
dev-down: ## Derruba tudo e remove volumes
	docker compose -f $(COMPOSE_FILE) down -v

.PHONY: dev-logs
dev-logs: ## Tail dos logs do docker compose
	docker compose -f $(COMPOSE_FILE) logs -f --tail=100

##@ Kubernetes (kind)

.PHONY: kind-up
kind-up: ## Cria cluster kind + instala PICKStack (umbrella)
	./scripts/bootstrap-kind.sh

.PHONY: kind-down
kind-down: ## Deleta o cluster kind
	./scripts/teardown-kind.sh

##@ Helm

.PHONY: helm-deps
helm-deps: ## helm dependency update no umbrella (baixa Bitnami)
	helm dependency update $(HELM_CHART)

.PHONY: helm-lint
helm-lint: ## helm lint no umbrella e em cada subchart
	helm lint $(HELM_CHART)
	@for c in infra/helm/charts/*; do \
		echo ""; echo "-- linting $$c --"; \
		helm lint $$c || exit 1; \
	done

.PHONY: helm-template
helm-template: ## Renderiza o umbrella com values-dev em $(RENDERED)
	helm template pickstack $(HELM_CHART) \
		-f $(HELM_VALUES) \
		-f $(HELM_VALUES_DEV) \
		> $(RENDERED)
	@echo "$(G)✓$(R) render salvo em $(RENDERED)  ($$(wc -l < $(RENDERED)) linhas)"

##@ Testes

.PHONY: test
test: ## Roda `deno test` para cada microsserviço
	@set -e; for svc in $(SERVICES); do \
		echo ""; echo "$(B)== test: $$svc ==$(R)"; \
		(cd services/$$svc && deno task test); \
	done

##@ Ajuda

.PHONY: help
help: ## Lista todos os targets
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(B)Uso:$(R)\n  make $(D)<target>$(R)\n"} \
		/^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(B)%-15s$(R) %s\n", $$1, $$2 } \
		/^##@/ { printf "\n$(B)%s$(R)\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@echo ""
