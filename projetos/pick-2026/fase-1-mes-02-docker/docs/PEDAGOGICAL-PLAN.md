# PICKStack — Plano Pedagógico (PICK 2026, 12 meses)

> Como o **PICKStack** vira o projeto prático do **PICK** (Programa Intensivo em Containers e Kubernetes) — uma plataforma SaaS modular operada pelos alunos ao longo do programa.

Este documento mapeia cada bloco do currículo do PICK em **entregas concretas no PICKStack**: o que o aluno faz com o projeto naquela fase, o que ele aprende com a entrega, e como ele demonstra (a "entrega" no sentido pedagógico).

---

## Filosofia

O PICKStack **não é um projeto fictício**. Ele é uma plataforma SaaS real, operada como tal:

- **Você é o operador.** Cada aluno faz fork e roda a plataforma no cluster dele (kind/k3d local, e depois EC2/EKS/cloud).
- **Não pule camadas.** Cada mês adiciona uma capacidade nova. Não dá pra fazer ArgoCD se você ainda não fez `kubectl apply` na mão pra sentir a dor.
- **Quebre de propósito.** Depois que funcionar, derrube serviço, mate node, suba versão errada. O que aprende mais é o aluno que sabe consertar.
- **Documente o caminho.** Cada aluno mantém `NOTAS.md` no fork — vira runbook pessoal de carreira.

---

## Visão geral — 12 meses

| Mês | Bloco curricular | Entrega no PICKStack | Conceito-chave |
|---|---|---|---|
| 1 | Docker fundamentos | Rodar a plataforma com `docker compose` | Containers, imagens, networks |
| 2 | Docker avançado | Multi-stage Dockerfiles otimizados para cada serviço | Image size, build cache, security scanning |
| 3 | Docker em produção | Registry privado + CI build matrix + image signing | GHCR/Harbor, cosign, supply chain |
| 4 | Kubernetes — workloads | Migrar do compose pra K8s; Deployments + Services | Pods, ReplicaSets, Services |
| 5 | Kubernetes — networking | Ingress + NetworkPolicy entre módulos | Ingress controllers, DNS, policies |
| 6 | Kubernetes — config & state | ConfigMaps, Secrets, PVCs, StatefulSet pro Postgres | Persistência, ConfigMap, Secret patterns |
| 7 | CKA prep | Cluster ops (etcd backup, node drain, upgrades) no cluster do PICKStack | Troubleshooting, cluster lifecycle |
| 8 | CKAD prep | Helm chart por serviço, probes corretos, jobs, multi-container | Packaging, app deployment patterns |
| 9 | Observability | Prometheus + Grafana + Loki + Tempo + Alertmanager monitorando o PICKStack | SLO/SLI, dashboards, alertas |
| 10 | ArgoCD | App-of-apps + sync waves + image updater + rollback | GitOps, declarative ops |
| 11 | Mentoria + módulo novo | Cada aluno propõe e implementa um módulo novo (journal, comunidade, etc.) ou opera com SLO | Engenharia ponta-a-ponta |
| 12 | Projeto final | Demonstração: cluster próprio, GitOps ativo, SLO publicado, runbook | Pitch técnico + operação real |

---

## Mês 1 — Docker fundamentos

**Currículo PICK:** o que é container, namespaces, cgroups, imagens, `docker run`, redes, volumes, `docker compose`.

**Entrega no PICKStack:**
1. Clone o repo (`git clone <fork>`).
2. Suba a infra base (Postgres, Redis, NATS) com `docker compose -f infra/docker-compose.dev.yml --profile infra up`.
3. Suba os serviços em compose também (sem buildar — usa imagens já publicadas no GHCR pelo time do PICK).
4. Acesse `http://localhost:5173` e cadastre um usuário.
5. Crie um deck de cards, faça uma sessão pomodoro, abra um roadmap.

**O que o aluno aprende:**
- A diferença entre imagem e container.
- Como `docker compose` orquestra múltiplos serviços.
- Volumes nomeados (persistência do Postgres entre `down`/`up`).
- Networks (por que `postgres` resolve dentro da rede compose mas não fora).

**Entrega formal:** print do `docker ps` mostrando todos os serviços UP + screenshot do dashboard funcionando com uma sessão registrada.

---

## Mês 2 — Docker avançado

**Currículo:** multi-stage builds, image scanning, distroless, build cache, ARG vs ENV, healthchecks, layer optimization.

**Entrega no PICKStack:**
1. Cada aluno escolhe **um serviço** (auth-svc, focus-svc, cards-svc, trilha-svc, api-gateway, web) e otimiza o Dockerfile dele.
2. Meta: reduzir tamanho da imagem em ≥40% sem perder funcionalidade.
3. Adiciona `HEALTHCHECK` no Dockerfile e usa em compose.
4. Roda `docker scout` ou `trivy` na imagem e mitiga vulnerabilidades.
5. Abre PR contra o fork dele (NÃO no upstream) com o Dockerfile otimizado.

**O que o aluno aprende:**
- Como escolher base image (distroless vs alpine vs slim).
- Diferença entre build stage e runtime stage.
- Como ler `docker history` pra entender o que pesa.
- Scanning de vulnerabilidades como parte do fluxo.

**Entrega formal:** diff do Dockerfile antes/depois + saída do `docker images` mostrando o tamanho + relatório do scanner.

---

## Mês 3 — Docker em produção

**Currículo:** registry privado, CI build, image signing, SBOM, supply chain.

**Entrega:**
1. Configurar GitHub Actions no fork: workflow `.github/workflows/build.yml` que faz build matrix dos 6 serviços e pushpa pra GHCR pessoal (`ghcr.io/<seu-usuario>/pickstack-<svc>`).
2. Sign images com `cosign` (chave gerada localmente).
3. Gerar SBOM com `syft`.
4. README do fork tem badge de build status.

**Aprende:** GHCR auth, matrix builds, secrets em Actions, cosign keyless ou key-pair, SBOM básico.

**Entrega:** link pro GHCR pessoal com 6 imagens assinadas + workflow rodando verde.

---

## Mês 4 — Kubernetes: workloads

**Currículo:** kubectl, pods, deployments, services, replicaset, manifests YAML.

**Entrega:**
1. Subir `kind` (ou `k3d`) localmente.
2. **Esquecer o compose.** Escrever os manifestos K8s na mão para cada serviço (sem usar Helm ainda):
   - `Deployment` com 1 replica
   - `Service ClusterIP`
   - `ConfigMap` com env não-secret
   - `Secret` com `DATABASE_URL`, `JWT_SECRET`
3. Aplicar com `kubectl apply -f <manifesto>` um por um.
4. Postgres ainda pode rodar fora do cluster (mais simples agora) — usar `ExternalName Service` ou apontar `DATABASE_URL` para host.docker.internal.

**Aprende:** o modelo declarativo, `kubectl describe`, `kubectl logs`, namespaces, selectors, labels.

**Entrega:** `kubectl get all -n pickstack` com todos os pods Running + acesso ao dashboard via `kubectl port-forward`.

---

## Mês 5 — Kubernetes: networking

**Currículo:** Ingress controller, DNS interno, NetworkPolicy, service mesh (introdução).

**Entrega:**
1. Instalar nginx-ingress no cluster.
2. Configurar Ingress pro `web` e pro `api-gateway` com hosts (`pickstack.local`).
3. Configurar `/etc/hosts` pra resolver.
4. NetworkPolicy:
   - Default deny no namespace `pickstack`.
   - Permitir `api-gateway` → `*-svc`.
   - Permitir `*-svc` → `postgres`, `redis`, `nats`.
   - Bloquear web → módulos diretamente (deve passar pelo gateway).
5. Provar que a policy funciona: tentar `curl` direto entre pods que não deveriam falar.

**Aprende:** L7 vs L4, certificados (cert-manager opcional), DNS dentro do cluster, segmentação de tráfego.

**Entrega:** print do Ingress funcionando + saída de `kubectl exec` mostrando que NetworkPolicy bloqueia tráfego não-autorizado.

---

## Mês 6 — Kubernetes: config & state

**Currículo:** ConfigMap vs Secret, PVC, StorageClass, StatefulSet, headless service.

**Entrega:**
1. **Migrar Postgres pra dentro do cluster** como StatefulSet (3 replicas com replication — opcional, ou 1 replica com PVC pra começar).
2. Trocar todos os Secrets em texto pleno por sealed-secrets ou external-secrets (com Vault dev ou AWS Secrets Manager local).
3. Refactor: ConfigMap montado como arquivo, não env, em `auth-svc` (pra praticar o padrão).
4. PVC com StorageClass `standard` (kind tem built-in).
5. Backup manual do PVC: `kubectl cp` da pasta + script de restore.

**Aprende:** estado em K8s, ciclo de vida de PV/PVC, StorageClass, padrões de gerenciamento de secrets.

**Entrega:** Postgres rodando como StatefulSet com PVC, com sobrevivência a `kubectl delete pod postgres-0` (volta com os dados).

---

## Mês 7 — CKA prep (Cluster Operations)

**Currículo:** etcd backup/restore, certificados, node maintenance, upgrades, troubleshooting.

**Entrega:**
1. Backup do etcd do cluster do PICKStack via `etcdctl snapshot save`.
2. Simular perda do master e restaurar.
3. Drenar um worker node, ver que pods reschedulam.
4. Resolver problemas plantados pelo instrutor:
   - Pod em CrashLoopBackOff
   - Service que não bate em endpoints
   - DNS quebrado em um pod
   - Image pull error
   - PVC pending
5. Documentar cada problema no `NOTAS.md`: sintoma → diagnóstico → fix → o que aprendi.

**Aprende:** o modelo mental de troubleshooting K8s. Como o CKA cobra.

**Entrega:** runbook de troubleshooting com pelo menos 5 cenários documentados + simulado CKA na plataforma (módulo `simulados` se já existir, ou em papel).

---

## Mês 8 — CKAD prep (App Deployment)

**Currículo:** Helm, probes, init containers, jobs, cronjobs, multi-container patterns (sidecar, ambassador, adapter).

**Entrega:**
1. Substituir os manifestos crus por **Helm chart** por serviço (já tem skeleton em `infra/helm/`).
2. Configurar **probes corretos** em cada serviço:
   - Liveness: `/healthz`
   - Readiness: `/readyz` (testa DB)
   - Startup probe pra `auth-svc` (pode demorar a inicializar com migrations)
3. Adicionar `Job` que roda **migrations** antes do deployment do auth-svc (`helm.sh/hook: pre-install`).
4. Adicionar `CronJob` `srs-scheduler` que roda à meia-noite e marca cards como due.
5. Sidecar: adicionar **Promtail** como sidecar do `api-gateway` (forwards logs pro Loki) — pra praticar pattern multi-container.

**Aprende:** Helm template syntax, hooks, probes que não param o pod por acidente, jobs idempotentes.

**Entrega:** `helm install pickstack ./infra/helm/pickstack` funciona zero-to-running.

---

## Mês 9 — Observability

**Currículo:** Prometheus, Grafana, Loki, Tempo, Alertmanager, SLI/SLO/error budget.

**Entrega:**
1. Instalar **kube-prometheus-stack** no cluster.
2. Adicionar `ServiceMonitor` em cada serviço do PICKStack.
3. Criar dashboards Grafana versionados em `infra/grafana/`:
   - "PICKStack Overview" — request rate, error rate, p99 latency por serviço
   - "Focus Module" — sessões/dia, abandonment rate
   - "Cards Module" — reviews/dia, retention curve
4. Loki + Promtail coletando logs estruturados.
5. Tempo recebendo traces (OpenTelemetry SDK nos serviços).
6. Definir **3 SLOs** com error budget:
   - `api-gateway`: 99.5% das requisições com status < 500 em janela de 30d
   - `auth-svc`: p95 login < 500ms em janela de 7d
   - `cards-svc`: 99% dos `/review` retornam em < 1s em janela de 7d
7. Alertas via Alertmanager → webhook (Slack/Discord pessoal).

**Aprende:** que observability **é** parte do produto, não um adendo. Como definir SLO honesto.

**Entrega:** Grafana acessível com 3 dashboards + 1 alerta disparado e mitigado (simulado).

---

## Mês 10 — ArgoCD (GitOps)

**Currículo:** instalação, Application, app-of-apps, sync waves, image updater, rollback, multi-cluster.

**Entrega:**
1. Instalar ArgoCD no cluster.
2. Aplicar o `infra/argocd/app-of-apps.yaml` apontando para o fork do aluno.
3. Configurar:
   - Sync automático com pruning
   - Self-heal
   - Sync waves (infra → datastore → backend → frontend)
4. **Mudança em produção só via Git.** Praticar:
   - Mudar replica count num PR → merge → ArgoCD aplica.
   - Mudar imagem (bump versão) → ArgoCD detecta drift → sincroniza.
5. Instalar **argocd-image-updater** pra auto-bump de imagens em ambiente de dev.
6. Simular rollback: mudar imagem pra versão quebrada → ver erro → reverter commit → ver ArgoCD reverter.

**Aprende:** GitOps de verdade. Por que o cluster é desejo, não realidade. Como auditar mudanças.

**Entrega:** screencast (3 min) mostrando: PR alterando o chart → merge → ArgoCD sync → mudança em produção. + Rollback bem-sucedido.

---

## Mês 11 — Módulo novo / Operação com SLO

**Currículo:** mentoria com profissionais top + capstone individual.

**Entrega — escolha um caminho:**

**Caminho A: Implementar um módulo novo no PICKStack.**

Sugestões:
- `journal-svc` — diário de bordo do aluno, com resumos via IA.
- `simulados-svc` — banco de questões + simulado cronometrado CKA/CKAD.
- `comunidade-svc` — grupos de estudo, perfis públicos, follows.
- `integrations-svc` — sync com GitHub commits (sinal de "estudei").

Inclui: schema, endpoints, frontend (uma rota nova em `web/`), Dockerfile, chart Helm, ServiceMonitor, dashboard Grafana, alerta. Tudo pelo fluxo GitOps.

**Caminho B: Operar um módulo existente com SLO.**

Pegar um módulo (focus, cards, trilha) e:
- Definir SLO formal (com error budget mensal).
- Implementar alertas que disparam ao queimar budget.
- Construir runbook pra cada alerta.
- Submeter o módulo a **chaos**: matar pods, lentidão de rede, falha de DB. Ver se SLO sobrevive.
- Apresentar postmortem dos incidentes (mesmo simulados).

**Aprende:** engenharia de plataforma, não só infraestrutura.

**Entrega:** PR mergeado no upstream do PICKStack com a feature/operação + apresentação de 10 min na mentoria.

---

## Mês 12 — Projeto final

**Currículo:** consolidação + carreira.

**Entrega:**
- **Demo de 15 min** pra banca (instrutores + convidados):
  - Cluster próprio (EC2 ou local) rodando o PICKStack completo.
  - GitOps ativo: faz uma mudança ao vivo via PR.
  - Mostra observabilidade: dashboard, alerta, logs.
  - Mostra resiliência: mata um pod, mostra recovery.
  - Pitch: qual problema resolve, métricas de adoção (mesmo simuladas), aprendizado.
- **Repositório do aluno** público com README contando a jornada (12 meses de commits e issues).
- **Runbook pessoal** documentando os 15 cenários de troubleshooting que enfrentou.

**Aprende:** comunicação técnica, narrativa de carreira, o "antes e depois" de um ano.

**Entrega final:** vídeo da demo (3 min para a turma + 15 min para a banca) + repo público + runbook.

---

## Como o time do PICK opera este projeto

- **Upstream** (`linuxtips/pickstack`): mantido pelo time. Releases versionadas por marco curricular (`v0.1.0` = Mês 4 estado, `v0.2.0` = Mês 6, etc.).
- **Alunos:** fazem fork no GitHub pessoal. PRs entre forks são incentivados (alunos revendo uns aos outros).
- **Issues:** o time abre **issues didáticas** (`good first issue`, `mes-5`, `mes-7-cka`) com escopo claro. Aluno escolhe e resolve.
- **Releases:** cada release do upstream é acompanhada por um post no canal da turma com "o que mudou e como aplicar".
- **Mentoria:** os profissionais convidados revisam PRs reais dos alunos. É o equivalente a code review em empresa.

---

## Não-objetivos pedagógicos

Coisas que **não** estão no escopo da Fase 1 (PICK 2026):
- Service mesh (Istio/Linkerd) — pode aparecer em uma trilha avançada futura.
- Multi-cluster federation — exercício opcional na semana de capstone.
- Operadores Kubernetes (CRDs + controllers) — tópico para um curso dedicado.
- ML/IA em produção real (a IA do PICKStack é mock até virar SaaS hosted).

---

## Como medir sucesso

| Métrica | Meta para a turma de 2026 |
|---|---|
| % de alunos com fork ativo | ≥ 80% após mês 3 |
| % de alunos com cluster próprio rodando o stack | ≥ 70% após mês 6 |
| Issues didáticas resolvidas (média por aluno) | ≥ 8 ao longo do ano |
| PRs cross-fork (peer review) | ≥ 3 por aluno |
| Cobertura no projeto final (cluster + GitOps + obs + SLO) | ≥ 60% dos alunos demonstrando todos os 4 |
| Aprovação no CKA (entre quem fez a prova) | ≥ 75% |
| Aprovação no CKAD | ≥ 80% |

---

**O PICKStack é o veículo. O destino é o aluno saber operar uma plataforma de verdade no fim do ano.**
