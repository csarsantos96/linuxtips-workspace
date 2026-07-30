// Handlers de cards (criação, edição, listagem, review, due).

import { Hono } from "hono";
import { and, eq, lte, sql as dsql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { cards, decks, reviews } from "../db/schema.ts";
import { getAuth, requireAuth } from "../middleware/auth.ts";
import { sm2 } from "../lib/sm2.ts";
import { cardsCreatedTotal, cardsReviewsTotal } from "../lib/prom.ts";

interface CardBody {
  front?: string;
  back?: string;
  tags?: string[];
}

interface ReviewBody {
  quality?: number;
}

export function cardsRoutes(db: Db) {
  const app = new Hono();
  app.use("*", requireAuth);

  app.post("/decks/:id/cards", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const deckId = c.req.param("id");
    let body: CardBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    if (!body.front || !body.back) {
      return c.json({ error: "front and back required", code: "bad_request" }, 400);
    }
    const [deck] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.tenantId, tenantId)));
    if (!deck) return c.json({ error: "deck not found", code: "not_found" }, 404);
    if (deck.ownerId !== userId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const [row] = await db
      .insert(cards)
      .values({
        deckId,
        tenantId,
        front: body.front,
        back: body.back,
        tags: body.tags ?? null,
      })
      .returning();
    cardsCreatedTotal.inc({ deck_id: deckId });
    return c.json(row, 201);
  });

  app.get("/decks/:id/cards", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const deckId = c.req.param("id");
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const [deck] = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.tenantId, tenantId)));
    if (!deck) return c.json({ error: "deck not found", code: "not_found" }, 404);
    if (deck.ownerId !== userId && !deck.isPublic) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const rows = await db
      .select()
      .from(cards)
      .where(and(eq(cards.deckId, deckId), eq(cards.tenantId, tenantId)))
      .limit(limit)
      .offset(offset);
    return c.json(rows);
  });

  app.patch("/cards/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    let body: CardBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.tenantId, tenantId)));
    if (!card) return c.json({ error: "not found", code: "not_found" }, 404);
    const [deck] = await db.select().from(decks).where(eq(decks.id, card.deckId));
    if (!deck || deck.ownerId !== userId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    const patch: Partial<typeof cards.$inferInsert> = {};
    if (body.front !== undefined) patch.front = body.front;
    if (body.back !== undefined) patch.back = body.back;
    if (body.tags !== undefined) patch.tags = body.tags;
    const [updated] = await db.update(cards).set(patch).where(eq(cards.id, id)).returning();
    return c.json(updated);
  });

  app.delete("/cards/:id", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.tenantId, tenantId)));
    if (!card) return c.json({ error: "not found", code: "not_found" }, 404);
    const [deck] = await db.select().from(decks).where(eq(decks.id, card.deckId));
    if (!deck || deck.ownerId !== userId) {
      return c.json({ error: "forbidden", code: "forbidden" }, 403);
    }
    await db.delete(cards).where(eq(cards.id, id));
    return c.body(null, 204);
  });

  app.post("/cards/:id/review", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    let body: ReviewBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    const q = Number(body.quality);
    if (!Number.isFinite(q) || q < 0 || q > 5) {
      return c.json({ error: "quality must be 0..5", code: "bad_request" }, 400);
    }
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.tenantId, tenantId)));
    if (!card) return c.json({ error: "not found", code: "not_found" }, 404);

    const out = sm2({
      quality: q,
      easiness: card.easiness,
      repetitions: card.repetitions,
      intervalDays: card.intervalDays,
    });

    const [updated] = await db
      .update(cards)
      .set({
        easiness: out.easiness,
        repetitions: out.repetitions,
        intervalDays: out.intervalDays,
        dueAt: out.dueAt,
      })
      .where(eq(cards.id, id))
      .returning();

    await db.insert(reviews).values({
      cardId: id,
      tenantId,
      userId,
      quality: q,
      prevEasiness: card.easiness,
      nextEasiness: out.easiness,
      nextIntervalDays: out.intervalDays,
    });
    cardsReviewsTotal.inc({ quality: String(q) });

    return c.json({
      card: updated,
      next_due_at: out.dueAt.toISOString(),
      interval_days: out.intervalDays,
    });
  });

  app.get("/review/due", async (c) => {
    const { tenantId } = getAuth(c);
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 200);
    const deckId = c.req.query("deck_id");
    const filters = [eq(cards.tenantId, tenantId), lte(cards.dueAt, new Date())];
    if (deckId) filters.push(eq(cards.deckId, deckId));
    const rows = await db
      .select()
      .from(cards)
      .where(and(...filters))
      .orderBy(cards.dueAt)
      .limit(limit);
    return c.json(rows);
  });

  app.get("/stats/retention", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const overall = await db.execute(dsql`
      SELECT
        COUNT(*)::int AS total_reviews,
        COALESCE(AVG(quality), 0)::float AS avg_quality
      FROM cards.reviews
      WHERE tenant_id = ${tenantId}::uuid AND user_id = ${userId}::uuid
    `);
    const byDeck = await db.execute(dsql`
      SELECT d.id AS deck_id, d.name, COALESCE(AVG(r.quality), 0)::float AS avg
      FROM cards.reviews r
      JOIN cards.cards c ON c.id = r.card_id
      JOIN cards.decks d ON d.id = c.deck_id
      WHERE r.tenant_id = ${tenantId}::uuid AND r.user_id = ${userId}::uuid
      GROUP BY d.id, d.name
      ORDER BY d.name
    `);
    const overallRow = (overall as unknown as Array<
      { total_reviews: number; avg_quality: number }
    >)[0] ?? { total_reviews: 0, avg_quality: 0 };
    return c.json({
      total_reviews: overallRow.total_reviews,
      avg_quality: Math.round(overallRow.avg_quality * 100) / 100,
      by_deck: byDeck as unknown as Array<{ deck_id: string; name: string; avg: number }>,
    });
  });

  return app;
}
