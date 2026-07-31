// Handlers de roadmaps e nodes.

import { Hono } from "hono";
import { and, asc, eq, or, sql as dsql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { roadmapNodes, roadmaps, userProgress } from "../db/schema.ts";
import { getAuth, requireAuth } from "../middleware/auth.ts";
import { trilhaProgressTotal } from "../lib/prom.ts";

interface NodeInput {
  external_id: string;
  title: string;
  description?: string;
  category?: string;
  depends_on?: string[];
  // deno-lint-ignore no-explicit-any
  resources?: any;
  order_index?: number;
}

interface RoadmapBody {
  name?: string;
  description?: string;
  is_public?: boolean;
  source_url?: string;
  nodes?: NodeInput[];
}

interface ProgressBody {
  status?: string;
  notes?: string;
}

const STATUSES = new Set(["todo", "learning", "done"]);

export function roadmapsRoutes(db: Db) {
  const app = new Hono();
  app.use("*", requireAuth);

  app.get("/roadmaps", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const scope = (c.req.query("scope") ?? "all").toLowerCase();
    let where;
    if (scope === "mine") {
      where = and(eq(roadmaps.tenantId, tenantId), eq(roadmaps.ownerId, userId));
    } else if (scope === "public") {
      where = eq(roadmaps.isPublic, true);
    } else {
      where = and(
        or(eq(roadmaps.ownerId, userId), eq(roadmaps.isPublic, true)),
        or(eq(roadmaps.tenantId, tenantId), eq(roadmaps.isPublic, true)),
      );
    }
    const rows = await db.select().from(roadmaps).where(where);
    return c.json(rows);
  });

  app.post("/roadmaps", async (c) => {
    const { userId, tenantId } = getAuth(c);
    let body: RoadmapBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    if (!body.name) {
      return c.json({ error: "name required", code: "bad_request" }, 400);
    }
    if (!Array.isArray(body.nodes) || body.nodes.length === 0) {
      return c.json({ error: "at least one node required", code: "bad_request" }, 400);
    }
    // valida external_ids únicos
    const ids = new Set<string>();
    for (const n of body.nodes) {
      if (!n.external_id || !n.title) {
        return c.json(
          { error: "each node requires external_id and title", code: "bad_request" },
          400,
        );
      }
      if (ids.has(n.external_id)) {
        return c.json(
          { error: `duplicate external_id: ${n.external_id}`, code: "bad_request" },
          400,
        );
      }
      ids.add(n.external_id);
    }

    // transação: roadmap + nodes
    const created = await db.transaction(async (tx) => {
      const [rm] = await tx
        .insert(roadmaps)
        .values({
          tenantId,
          ownerId: userId,
          name: body.name!,
          description: body.description ?? null,
          isPublic: !!body.is_public,
          sourceUrl: body.source_url ?? null,
        })
        .returning();

      await tx.insert(roadmapNodes).values(
        body.nodes!.map((n, i) => ({
          roadmapId: rm.id,
          externalId: n.external_id,
          title: n.title,
          description: n.description ?? null,
          category: n.category ?? null,
          dependsOn: n.depends_on ?? null,
          resources: n.resources ?? null,
          orderIndex: n.order_index ?? i,
        })),
      );

      return rm;
    });

    return c.json(created, 201);
  });

  app.get("/roadmaps/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [rm] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    if (!rm) return c.json({ error: "not found", code: "not_found" }, 404);
    const owns = rm.ownerId === userId && rm.tenantId === tenantId;
    if (!owns && !rm.isPublic) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const nodes = await db
      .select()
      .from(roadmapNodes)
      .where(eq(roadmapNodes.roadmapId, id))
      .orderBy(asc(roadmapNodes.orderIndex));
    const progress = await db
      .select()
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, userId),
          eq(userProgress.tenantId, tenantId),
        ),
      );
    const progressByNode = new Map(progress.map((p) => [p.nodeId, p]));
    return c.json({
      ...rm,
      nodes: nodes.map((n) => ({
        ...n,
        progress: progressByNode.get(n.id) ?? null,
      })),
    });
  });

  app.patch("/roadmaps/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    let body: RoadmapBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    const [rm] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    if (!rm) return c.json({ error: "not found", code: "not_found" }, 404);
    if (rm.ownerId !== userId || rm.tenantId !== tenantId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const patch: Partial<typeof roadmaps.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.is_public !== undefined) patch.isPublic = !!body.is_public;
    if (body.source_url !== undefined) patch.sourceUrl = body.source_url;
    const [updated] = await db.update(roadmaps).set(patch).where(eq(roadmaps.id, id)).returning();
    return c.json(updated);
  });

  app.delete("/roadmaps/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [rm] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    if (!rm) return c.json({ error: "not found", code: "not_found" }, 404);
    if (rm.ownerId !== userId || rm.tenantId !== tenantId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    await db.delete(roadmaps).where(eq(roadmaps.id, id));
    return c.body(null, 204);
  });

  app.post("/roadmaps/:id/clone", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [rm] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
    if (!rm) return c.json({ error: "not found", code: "not_found" }, 404);
    if (!rm.isPublic && (rm.ownerId !== userId || rm.tenantId !== tenantId)) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const nodes = await db
      .select()
      .from(roadmapNodes)
      .where(eq(roadmapNodes.roadmapId, id))
      .orderBy(asc(roadmapNodes.orderIndex));

    const cloned = await db.transaction(async (tx) => {
      const [newRm] = await tx
        .insert(roadmaps)
        .values({
          tenantId,
          ownerId: userId,
          name: `${rm.name} (cópia)`,
          description: rm.description,
          isPublic: false,
          sourceUrl: rm.sourceUrl,
        })
        .returning();

      if (nodes.length > 0) {
        await tx.insert(roadmapNodes).values(
          nodes.map((n) => ({
            roadmapId: newRm.id,
            externalId: n.externalId,
            title: n.title,
            description: n.description,
            category: n.category,
            dependsOn: n.dependsOn,
            resources: n.resources,
            orderIndex: n.orderIndex,
          })),
        );
      }
      return newRm;
    });

    return c.json(cloned, 201);
  });

  app.patch("/nodes/:node_id/progress", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const nodeId = c.req.param("node_id");
    let body: ProgressBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    if (!body.status || !STATUSES.has(body.status)) {
      return c.json(
        { error: "status must be todo|learning|done", code: "bad_request" },
        400,
      );
    }
    const [node] = await db
      .select()
      .from(roadmapNodes)
      .where(eq(roadmapNodes.id, nodeId));
    if (!node) return c.json({ error: "node not found", code: "not_found" }, 404);
    const [rm] = await db.select().from(roadmaps).where(eq(roadmaps.id, node.roadmapId));
    if (!rm) return c.json({ error: "node not found", code: "not_found" }, 404);
    if (!rm.isPublic && (rm.ownerId !== userId || rm.tenantId !== tenantId)) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }

    const now = new Date();
    const [existing] = await db
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.nodeId, nodeId)));

    let result;
    if (existing) {
      const patch: Partial<typeof userProgress.$inferInsert> = {
        status: body.status,
        notes: body.notes ?? existing.notes,
        updatedAt: now,
      };
      if (body.status === "learning" && !existing.startedAt) patch.startedAt = now;
      if (body.status === "done" && !existing.completedAt) patch.completedAt = now;
      const [up] = await db
        .update(userProgress)
        .set(patch)
        .where(eq(userProgress.id, existing.id))
        .returning();
      result = up;
    } else {
      const [up] = await db
        .insert(userProgress)
        .values({
          tenantId,
          userId,
          nodeId,
          status: body.status,
          notes: body.notes ?? null,
          startedAt: body.status === "learning" || body.status === "done" ? now : null,
          completedAt: body.status === "done" ? now : null,
        })
        .returning();
      result = up;
    }
    trilhaProgressTotal.inc({ status: body.status });
    return c.json(result);
  });

  app.get("/stats/overview", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const byRoadmap = await db.execute(dsql`
      SELECT
        r.id AS roadmap_id,
        r.name,
        COUNT(n.id)::int AS total,
        COUNT(p.id) FILTER (WHERE p.status = 'done')::int AS done
      FROM trilha.roadmaps r
      JOIN trilha.roadmap_nodes n ON n.roadmap_id = r.id
      LEFT JOIN trilha.user_progress p
        ON p.node_id = n.id
       AND p.user_id = ${userId}::uuid
       AND p.tenant_id = ${tenantId}::uuid
      WHERE (r.owner_id = ${userId}::uuid AND r.tenant_id = ${tenantId}::uuid)
         OR r.is_public = TRUE
      GROUP BY r.id, r.name
      ORDER BY r.name
    `);
    const rows = byRoadmap as unknown as Array<
      { roadmap_id: string; name: string; total: number; done: number }
    >;
    const enriched = rows.map((r) => ({
      ...r,
      pct: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
    }));
    const totalNodes = enriched.reduce((s, r) => s + r.total, 0);
    const totalDone = enriched.reduce((s, r) => s + r.done, 0);
    return c.json({
      total_roadmaps: enriched.length,
      total_nodes_done: totalDone,
      completion_pct: totalNodes > 0 ? Math.round((totalDone / totalNodes) * 100) : 0,
      by_roadmap: enriched,
    });
  });

  return app;
}
