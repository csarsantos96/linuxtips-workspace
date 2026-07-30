// Smoke test do focus-svc — happy path dos endpoints principais.
// Requer DATABASE_URL apontando para um Postgres com o schema `focus` criado.
// Pulado automaticamente se DATABASE_URL não estiver setada.

import { assertEquals, assert } from "@std/assert";
import { createApp } from "../src/app.ts";
import { closeDb, getDb, runMigrations } from "../src/db/client.ts";

const DB_URL = Deno.env.get("DATABASE_URL");
const itDb = DB_URL ? Deno.test : Deno.test.ignore;

const USER = "11111111-1111-1111-1111-111111111111";
const TENANT = "22222222-2222-2222-2222-222222222222";

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
  const res = await app.request("/sessions", { method: "GET" });
  assertEquals(res.status, 401);
});

itDb("fluxo completo: start → end → list", async () => {
  await runMigrations();
  const app = createApp({ db: getDb() });

  const startRes = await app.request("/sessions/start", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "pomodoro", duration_min: 25 }),
  });
  assertEquals(startRes.status, 201);
  const session = await startRes.json();
  assert(session.id);

  const endRes = await app.request(`/sessions/${session.id}/end`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ note: "done" }),
  });
  assertEquals(endRes.status, 200);
  const ended = await endRes.json();
  assertEquals(ended.status, "completed");

  const listRes = await app.request("/sessions?limit=5", { headers: authHeaders() });
  assertEquals(listRes.status, 200);
  const list = await listRes.json();
  assert(Array.isArray(list.items));
  assert(typeof list.total === "number");

  const today = await (await app.request("/stats/today", { headers: authHeaders() })).json();
  assert(typeof today.daily_goal_min === "number");

  // novo: /sessions/today (happy path)
  const todayList = await (await app.request("/sessions/today", { headers: authHeaders() }))
    .json();
  assert(Array.isArray(todayList.items));

  await closeDb();
});
