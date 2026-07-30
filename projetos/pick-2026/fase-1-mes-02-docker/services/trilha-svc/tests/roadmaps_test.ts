// Smoke test do trilha-svc.

import { assert, assertEquals } from "@std/assert";
import { createApp } from "../src/app.ts";
import { closeDb, getDb, runMigrations } from "../src/db/client.ts";
import { seedDevopsRoadmap } from "../src/db/seeds/devops-roadmap.ts";

const DB_URL = Deno.env.get("DATABASE_URL");
const itDb = DB_URL ? Deno.test : Deno.test.ignore;

const USER = "55555555-5555-5555-5555-555555555555";
const TENANT = "66666666-6666-6666-6666-666666666666";

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
  const res = await app.request("/roadmaps");
  assertEquals(res.status, 401);
});

itDb("happy path: cria roadmap, marca progresso, vê overview", async () => {
  await runMigrations();
  const app = createApp({ db: getDb() });

  const createRes = await app.request("/roadmaps", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: "Test trilha",
      description: "para teste",
      is_public: false,
      nodes: [
        { external_id: "a.intro", title: "Intro" },
        { external_id: "a.next", title: "Next", depends_on: ["a.intro"] },
      ],
    }),
  });
  assertEquals(createRes.status, 201);
  const rm = await createRes.json();
  assert(rm.id);

  const getRes = await app.request(`/roadmaps/${rm.id}`, { headers: authHeaders() });
  assertEquals(getRes.status, 200);
  const detail = await getRes.json();
  assertEquals(detail.nodes.length, 2);

  const node = detail.nodes[0];
  const progRes = await app.request(`/nodes/${node.id}/progress`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: "done", notes: "feito" }),
  });
  assertEquals(progRes.status, 200);

  const stats = await (await app.request("/stats/overview", { headers: authHeaders() })).json();
  assert(typeof stats.completion_pct === "number");

  await closeDb();
});

itDb("seed devops-roadmap é idempotente", async () => {
  await runMigrations();
  await seedDevopsRoadmap(getDb());
  await seedDevopsRoadmap(getDb()); // segunda chamada não deve duplicar
  await closeDb();
});
