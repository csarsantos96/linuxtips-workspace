// Seed idempotente do roadmap "DevOps PICK 2026".
// Cria como roadmap público de propriedade de um "system user" determinístico.
// Re-execução não duplica (lookup por owner+name).

import { eq, and } from "drizzle-orm";
import type { Db } from "../client.ts";
import { roadmaps, roadmapNodes } from "../schema.ts";
import { logger } from "../../lib/logger.ts";

// IDs determinísticos para o seed (UUID v4 estáveis).
const SEED_OWNER_ID = "00000000-0000-0000-0000-000000000001";
const SEED_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ROADMAP_NAME = "DevOps PICK 2026";

interface SeedNode {
  external_id: string;
  title: string;
  description: string;
  category: string;
  depends_on?: string[];
  resources?: Array<{ title: string; url: string; type: string }>;
}

const NODES: SeedNode[] = [
  {
    external_id: "linux.basics",
    title: "Linux: shell, processos, filesystem",
    description: "Comandos essenciais, permissões, systemd, journalctl, redes.",
    category: "linux",
    resources: [
      { title: "LINUXtips - Descomplicando o Linux", url: "https://linuxtips.io", type: "course" },
    ],
  },
  {
    external_id: "linux.networking",
    title: "Linux networking: iptables, nftables, netns",
    description: "Como containers usam namespaces; veth, bridge, iptables NAT.",
    category: "linux",
    depends_on: ["linux.basics"],
  },
  {
    external_id: "docker.intro",
    title: "Docker: imagens, containers, volumes",
    description: "Dockerfile, multi-stage, layers, BuildKit, docker compose.",
    category: "containers",
    depends_on: ["linux.basics"],
    resources: [
      {
        title: "Descomplicando Docker (LINUXtips)",
        url: "https://github.com/badtuxx/DescomplicandoDocker",
        type: "book",
      },
    ],
  },
  {
    external_id: "docker.security",
    title: "Docker hardening + image scanning",
    description: "Rootless, user namespaces, Trivy, distroless.",
    category: "containers",
    depends_on: ["docker.intro"],
  },
  {
    external_id: "k8s.core",
    title: "Kubernetes core: Pods, Deployments, Services",
    description: "Workloads, kubectl, manifests, namespaces, labels.",
    category: "kubernetes",
    depends_on: ["docker.intro"],
    resources: [
      {
        title: "Descomplicando Kubernetes (LINUXtips)",
        url: "https://github.com/badtuxx/DescomplicandoKubernetes",
        type: "book",
      },
    ],
  },
  {
    external_id: "k8s.config",
    title: "ConfigMap, Secret, Ingress",
    description: "Injetar config, gerenciar segredos, Ingress controllers.",
    category: "kubernetes",
    depends_on: ["k8s.core"],
  },
  {
    external_id: "k8s.storage",
    title: "PV, PVC, StorageClass, StatefulSet",
    description: "Persistência em K8s, volumes dinâmicos, workloads stateful.",
    category: "kubernetes",
    depends_on: ["k8s.core"],
  },
  {
    external_id: "k8s.scaling",
    title: "HPA, VPA, NetworkPolicy, RBAC",
    description: "Escala automática, isolamento de rede, autorização.",
    category: "kubernetes",
    depends_on: ["k8s.config"],
  },
  {
    external_id: "k8s.cka",
    title: "Preparação CKA",
    description: "Cluster ops, etcd backup, troubleshooting, kubeadm.",
    category: "certs",
    depends_on: ["k8s.scaling", "k8s.storage"],
  },
  {
    external_id: "k8s.ckad",
    title: "Preparação CKAD",
    description: "Multi-container, probes, jobs, init containers.",
    category: "certs",
    depends_on: ["k8s.config"],
  },
  {
    external_id: "helm.charts",
    title: "Helm 3: charts, releases, templating",
    description: "Helm chart por módulo, umbrella charts, values overrides.",
    category: "tooling",
    depends_on: ["k8s.core"],
  },
  {
    external_id: "argocd.basics",
    title: "ArgoCD: GitOps básico",
    description: "Application, Project, sync policy, hooks.",
    category: "gitops",
    depends_on: ["helm.charts"],
    resources: [
      {
        title: "Descomplicando ArgoCD",
        url: "https://github.com/badtuxx/DescomplicandoArgoCD",
        type: "book",
      },
    ],
  },
  {
    external_id: "argocd.app-of-apps",
    title: "App-of-apps, sync waves, image updater",
    description: "Patterns avançados de ArgoCD para multi-serviço.",
    category: "gitops",
    depends_on: ["argocd.basics"],
  },
  {
    external_id: "observability.metrics",
    title: "Prometheus + Grafana",
    description: "Métricas RED/USE, ServiceMonitor, dashboards, alerting.",
    category: "observability",
    depends_on: ["k8s.config"],
  },
  {
    external_id: "observability.logs-traces",
    title: "Loki + Tempo: logs e tracing",
    description: "Pipeline de logs, structured logging, OTel traces.",
    category: "observability",
    depends_on: ["observability.metrics"],
  },
  {
    external_id: "iac.terraform",
    title: "IaC: Terraform / OpenTofu",
    description: "Provisionamento declarativo, state, módulos.",
    category: "iac",
    depends_on: ["linux.basics"],
  },
];

export async function seedDevopsRoadmap(db: Db): Promise<void> {
  const existing = await db
    .select()
    .from(roadmaps)
    .where(and(eq(roadmaps.ownerId, SEED_OWNER_ID), eq(roadmaps.name, ROADMAP_NAME)));
  if (existing.length > 0) {
    logger.info("seed devops-roadmap: já existe, pulando", { roadmap_id: existing[0].id });
    return;
  }
  const [rm] = await db
    .insert(roadmaps)
    .values({
      tenantId: SEED_TENANT_ID,
      ownerId: SEED_OWNER_ID,
      name: ROADMAP_NAME,
      description:
        "Roadmap oficial do PICK 2026: do Linux ao GitOps. Use como ponto de partida e crie sua cópia editável via POST /roadmaps/:id/clone.",
      isPublic: true,
      sourceUrl: "https://linuxtips.io/pick",
    })
    .returning();

  await db.insert(roadmapNodes).values(
    NODES.map((n, i) => ({
      roadmapId: rm.id,
      externalId: n.external_id,
      title: n.title,
      description: n.description,
      category: n.category,
      dependsOn: n.depends_on ?? null,
      resources: n.resources ?? null,
      orderIndex: i,
    })),
  );

  logger.info("seed devops-roadmap: criado", {
    roadmap_id: rm.id,
    nodes: NODES.length,
  });
}
