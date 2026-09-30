// Handlers de decks.

import { Hono } from "hono";
import { and, eq, or, sql as dsql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { decks } from "../db/schema.ts";
import { getAuth, requireAuth } from "../middleware/auth.ts";

interface DeckBody {
  name?: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
}

export function decksRoutes(db: Db) {
  const app = new Hono();
  app.use("*", requireAuth);

  app.post("/decks", async (c) => {
    const { userId, tenantId } = getAuth(c);
    let body: DeckBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    if (!body.name || typeof body.name !== "string") {
      return c.json({ error: "name required", code: "bad_request" }, 400);
    }
    const [row] = await db
      .insert(decks)
      .values({
        tenantId,
        ownerId: userId,
        name: body.name,
        description: body.description ?? null,
        tags: body.tags ?? null,
        isPublic: !!body.is_public,
      })
      .returning();
    return c.json(row, 201);
  });

  app.get("/decks", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const rows = await db
      .select()
      .from(decks)
      .where(
        and(
          eq(decks.tenantId, tenantId),
          or(eq(decks.ownerId, userId), eq(decks.isPublic, true)),
        ),
      );
    return c.json(rows);
  });

  app.get("/decks/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [deck] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.tenantId, tenantId)));
    if (!deck) return c.json({ error: "not found", code: "not_found" }, 404);
    if (deck.ownerId !== userId && !deck.isPublic) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const stats = await db.execute(dsql`
      SELECT
        COUNT(*)::int AS card_count,
        COUNT(*) FILTER (WHERE due_at <= now())::int AS due_count
      FROM cards.cards
      WHERE deck_id = ${id}::uuid
    `);
    const s = (stats as unknown as Array<{ card_count: number; due_count: number }>)[0] ??
      { card_count: 0, due_count: 0 };
    return c.json({ ...deck, card_count: s.card_count, due_count: s.due_count });
  });

  app.patch("/decks/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    let body: DeckBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    const [deck] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.tenantId, tenantId)));
    if (!deck) return c.json({ error: "not found", code: "not_found" }, 404);
    if (deck.ownerId !== userId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const patch: Partial<typeof decks.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.is_public !== undefined) patch.isPublic = !!body.is_public;
    const [updated] = await db.update(decks).set(patch).where(eq(decks.id, id)).returning();
    return c.json(updated);
  });

  app.delete("/decks/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [deck] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.tenantId, tenantId)));
    if (!deck) return c.json({ error: "not found", code: "not_found" }, 404);
    if (deck.ownerId !== userId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    await db.delete(decks).where(eq(decks.id, id));
    return c.body(null, 204);
  });

  return app;
}
