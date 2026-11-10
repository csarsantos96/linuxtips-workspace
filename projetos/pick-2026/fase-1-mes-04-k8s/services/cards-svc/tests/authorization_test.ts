import { assert, assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.ts";
import { closeDb, getDb, runMigrations } from "../src/db/client.ts";
import { cards, decks, reviews } from "../src/db/schema.ts";

Deno.test({
  name: "private cards: same-tenant isolation, public access and revocation",
  ignore: !Deno.env.get("DATABASE_URL"),
  async fn(t) {
    await runMigrations();
    const db = getDb();
    const app = createApp({ db });
    const owner = crypto.randomUUID(), peer = crypto.randomUUID();
    const tenant = crypto.randomUUID(), otherTenant = crypto.randomUUID();
    const [privateDeck, publicDeck] = await db.insert(decks).values([
      { tenantId: tenant, ownerId: owner, name: "private", isPublic: false },
      { tenantId: tenant, ownerId: owner, name: "public", isPublic: true },
    ]).returning();
    const [privateCard, publicCard] = await db.insert(cards).values([
      {
        deckId: privateDeck.id,
        tenantId: tenant,
        front: "secret",
        back: "secret answer",
        dueAt: new Date(0),
      },
      {
        deckId: publicDeck.id,
        tenantId: tenant,
        front: "shared",
        back: "shared answer",
        dueAt: new Date(1),
      },
    ]).returning();
    async function request(
      path: string,
      user = peer,
      tid = tenant,
      method = "GET",
      body?: unknown,
    ) {
      return await app.request(path, {
        method,
        headers: { "x-user-id": user, "x-tenant-id": tid, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    async function deniedReview(id: string, user = peer, tid = tenant, expected = 403) {
      const before = await db.select().from(cards).where(eq(cards.id, id));
      const beforeReviews = await db.select().from(reviews).where(eq(reviews.cardId, id));
      const res = await request(`/cards/${id}/review`, user, tid, "POST", { quality: 5 });
      const payload = await res.json();
      assertEquals(res.status, expected);
      assert(!("card" in payload));
      assertEquals(await db.select().from(cards).where(eq(cards.id, id)), before);
      assertEquals(await db.select().from(reviews).where(eq(reviews.cardId, id)), beforeReviews);
    }
    try {
      await t.step("unfiltered queue applies visibility before limit", async () => {
        const res = await request("/review/due?limit=1");
        assertEquals(res.status, 200);
        const rows = await res.json();
        assertEquals(rows.map((c: { id: string }) => c.id), [publicCard.id]);
        assertEquals(rows[0].front, "shared");
        assert(!("decks" in rows[0]));
      });
      await t.step("filtered queue and HEAD do not expose private cards", async () => {
        const res = await request(`/review/due?deck_id=${privateDeck.id}`);
        assertEquals(await res.json(), []);
        assertEquals(res.status, 200);
        const head = await request(`/review/due?deck_id=${privateDeck.id}`, peer, tenant, "HEAD");
        assertEquals(head.status, 200);
        assertEquals(await head.text(), "");
      });
      await t.step(
        "private review denied without SRS or review side effects",
        () => deniedReview(privateCard.id),
      );
      await t.step("sibling reads and writes remain protected", async () => {
        for (
          const [path, method, body] of [
            [`/decks/${privateDeck.id}`, "GET", undefined],
            [`/decks/${privateDeck.id}/cards`, "GET", undefined],
            [`/cards/${privateCard.id}`, "PATCH", { front: "attack" }],
            [`/cards/${privateCard.id}`, "DELETE", undefined],
            [`/decks/${publicDeck.id}/cards`, "POST", { front: "attack", back: "attack" }],
          ] as const
        ) {
          const res = await request(path, peer, tenant, method, body);
          await res.text();
          assertEquals(res.status, 403);
        }
      });
      await t.step("another tenant cannot access even public cards", async () => {
        const res = await request(`/review/due?deck_id=${publicDeck.id}`, peer, otherTenant);
        assertEquals(await res.json(), []);
        await deniedReview(publicCard.id, peer, otherTenant, 404);
      });
      await t.step("owner can list and review private cards", async () => {
        // Ensure independent control even if the baseline attack already changed dueAt.
        await db.update(cards).set({ dueAt: new Date(0) }).where(eq(cards.id, privateCard.id));
        const res = await request(`/review/due?deck_id=${privateDeck.id}`, owner);
        assertEquals((await res.json())[0].id, privateCard.id);
        const review = await request(`/cards/${privateCard.id}/review`, owner, tenant, "POST", {
          quality: 5,
        });
        assertEquals(review.status, 200);
        const payload = await review.json();
        assertEquals(payload.card.id, privateCard.id);
        assert(payload.next_due_at);
      });
      await t.step("peer can review public cards; privatization revokes known IDs", async () => {
        const review = await request(`/cards/${publicCard.id}/review`, peer, tenant, "POST", {
          quality: 5,
        });
        assertEquals(review.status, 200);
        assertEquals((await review.json()).card.id, publicCard.id);
        const hide = await request(`/decks/${publicDeck.id}`, owner, tenant, "PATCH", {
          is_public: false,
        });
        assertEquals(hide.status, 200);
        await hide.json();
        await db.update(cards).set({ dueAt: new Date(0) }).where(eq(cards.id, publicCard.id));
        const due = await request(`/review/due?deck_id=${publicDeck.id}`);
        assertEquals(await due.json(), []);
        await deniedReview(publicCard.id);
      });
      await t.step("card and deck must agree on tenant", async () => {
        await db.update(decks).set({ tenantId: otherTenant, isPublic: true }).where(
          eq(decks.id, publicDeck.id),
        );
        const due = await request(`/review/due?deck_id=${publicDeck.id}`);
        assertEquals(await due.json(), []);
        await deniedReview(publicCard.id, peer, tenant, 404);
      });
    } finally {
      await db.delete(decks).where(eq(decks.id, privateDeck.id));
      await db.delete(decks).where(eq(decks.id, publicDeck.id));
      await closeDb();
    }
  },
});
