// Composição do app Hono do cards-svc.

import { Hono } from "hono";
import type { Db } from "./db/client.ts";
import { pingDb } from "./db/client.ts";
import { observability } from "./middleware/observability.ts";
import { renderMetrics } from "./lib/prom.ts";
import { decksRoutes } from "./handlers/decks.ts";
import { cardsRoutes } from "./handlers/cards.ts";

export interface AppDeps {
  db: Db;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.use("*", observability);

  app.get("/healthz", (c) => c.json({ status: "ok" }));
  app.get("/readyz", async (c) => {
    const ok = await pingDb();
    return c.json({ status: ok ? "ok" : "degraded", db: ok }, ok ? 200 : 503);
  });
  app.get("/metrics", () =>
    new Response(renderMetrics(), {
      headers: { "content-type": "text/plain; version=0.0.4" },
    })
  );

  app.route("/", decksRoutes(deps.db));
  app.route("/", cardsRoutes(deps.db));

  app.notFound((c) => c.json({ error: "not found", code: "not_found" }, 404));
  app.onError((err, c) => {
    console.error(JSON.stringify({
      level: "error",
      service: "cards-svc",
      msg: "unhandled error",
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }));
    return c.json({ error: "internal error", code: "internal" }, 500);
  });

  return app;
}
