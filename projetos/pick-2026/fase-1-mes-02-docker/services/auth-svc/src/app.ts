// Hono app factory — mantém main.ts magro e facilita testes integrados.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Db } from "./db/client.ts";
import { pingDb } from "./db/client.ts";
import { registerAuthRoutes } from "./handlers/auth.ts";
import { observability } from "./middleware/observability.ts";
import { renderMetrics } from "./lib/prom.ts";

export interface AppDeps {
  db: Db;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use("*", observability);
  app.use("*", cors({ origin: "*" }));

  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.get("/readyz", async (c) => {
    const ok = await pingDb();
    if (!ok) return c.json({ status: "not_ready", reason: "db_unreachable" }, 503);
    return c.json({ status: "ready" });
  });

  app.get("/metrics", (c) => {
    return new Response(renderMetrics(), {
      headers: { "content-type": "text/plain; version=0.0.4" },
    });
  });

  registerAuthRoutes(app, deps.db);

  app.notFound((c) => c.json({ error: "not found", code: "NOT_FOUND" }, 404));
  app.onError((err, c) => {
    return c.json({ error: String(err), code: "INTERNAL" }, 500);
  });

  return app;
}
