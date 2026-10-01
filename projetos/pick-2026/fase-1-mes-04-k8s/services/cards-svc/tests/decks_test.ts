// Smoke tests do cards-svc. Pulado se DATABASE_URL não estiver setado.

import { assert, assertEquals } from "@std/assert";
import { createApp } from "../src/app.ts";
import { closeDb, getDb, runMigrations } from "../src/db/client.ts";

const DB_URL = Deno.env.get("DATABASE_URL");
const itDb = DB_URL ? Deno.test : Deno.test.ignore;

const USER = "33333333-3333-3333-3333-333333333333";
const TENANT = "44444444-4444-4444-4444-444444444444";

function authHeaders() {
  return { "x-user-id": USER, "x-tenant-id": TENANT, "content-type": "application/json" };
}

Deno.test("healthz responde 200", async () => {
  const app = createApp({ db: {} as never });
  const res = await app.request("/healthz");
  assertEquals(res.status, 200);
});

Deno.test("requireAuth bloqueia sem headers", async () => {
  const app = createApp({ db: {} as never });
  const res = await app.request("/decks");
  assertEquals(res.status, 401);
});

itDb("happy path: cria deck, cria card, revisa, lista due", async () => {
  await runMigrations();
  const app = createApp({ db: getDb() });

  const deckRes = await app.request("/decks", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: "Test deck" }),
  });
  assertEquals(deckRes.status, 201);
  const deck = await deckRes.json();
  assert(deck.id);

  const cardRes = await app.request(`/decks/${deck.id}/cards`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ front: "What is K8s?", back: "Container orchestrator" }),
  });
  assertEquals(cardRes.status, 201);
  const card = await cardRes.json();

  const revRes = await app.request(`/cards/${card.id}/review`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ quality: 5 }),
  });
  assertEquals(revRes.status, 200);
  const rev = await revRes.json();
  assert(rev.next_due_at);

  const listRes = await app.request("/decks", { headers: authHeaders() });
  assertEquals(listRes.status, 200);

  await closeDb();
});
