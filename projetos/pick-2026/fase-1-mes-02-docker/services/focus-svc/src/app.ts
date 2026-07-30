// Composição do app Hono do focus-svc.

import { Hono } from "hono";
import type { Db } from "./db/client.ts";
import { pingDb } from "./db/client.ts";
import { observability } from "./middleware/observability.ts";
import { renderMetrics } from "./lib/prom.ts";
import { sessionsRoutes } from "./handlers/sessions.ts";

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

  app.get("/metrics", (c) =>
    new Response(renderMetrics(), {
      headers: { "content-type": "text/plain; version=0.0.4" },
    })
  );

  app.route("/", sessionsRoutes(deps.db));

  app.notFound((c) => c.json({ error: "not found", code: "not_found" }, 404));
  app.onError((err, c) => {
    console.error(JSON.stringify({
      level: "error",
      service: "focus-svc",
      msg: "unhandled error",
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }));
    return c.json({ error: "internal error", code: "internal" }, 500);
  });

  return app;
}
