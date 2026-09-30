// Hono app do gateway: CORS, observability, rate limit, roteamento por prefixo
// e validação de JWT em rotas não-/api/auth/*.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { observability } from "./middleware/observability.ts";
import { rateLimit } from "./middleware/ratelimit.ts";
import { requireAuth } from "./middleware/auth.ts";
import { forward } from "./proxy.ts";
import { renderMetrics } from "./lib/prom.ts";

function corsOptions() {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "*";
  if (raw.trim() === "*") return { origin: "*" } as const;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return { origin: list };
}

export function createApp(): Hono {
  const app = new Hono();

  app.use("*", observability);
  app.use("*", cors(corsOptions()));
  app.use("*", rateLimit);

  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.get("/readyz", async (c) => {
    // O gateway é "ready" se conseguir falar com o auth-svc (dependência crítica
    // para qualquer rota autenticada). Probes 503 enquanto o auth-svc não subir.
    const authUrl = Deno.env.get("AUTH_SVC_URL");
    if (!authUrl) return c.json({ status: "not_ready", reason: "no_auth_url" }, 503);
    try {
      const r = await fetch(`${authUrl}/healthz`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!r.ok) return c.json({ status: "not_ready", reason: "auth_unhealthy" }, 503);
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "not_ready", reason: "auth_unreachable" }, 503);
    }
  });

  app.get("/metrics", (c) =>
    new Response(renderMetrics(), {
      headers: { "content-type": "text/plain; version=0.0.4" },
    }),
  );

  // /api/auth/* — sem requireAuth (signup/login/refresh não têm token).
  app.all("/api/auth", (c) => forward(c, Deno.env.get("AUTH_SVC_URL") ?? "", "/api/auth"));
  app.all("/api/auth/*", (c) => forward(c, Deno.env.get("AUTH_SVC_URL") ?? "", "/api/auth"));

  // Demais módulos — exigem JWT válido.
  const protectedRoutes: [string, string][] = [
    ["/api/focus", "FOCUS_SVC_URL"],
    ["/api/cards", "CARDS_SVC_URL"],
    ["/api/trilha", "TRILHA_SVC_URL"],
  ];
  for (const [prefix, envKey] of protectedRoutes) {
    app.use(`${prefix}/*`, requireAuth);
    app.use(prefix, requireAuth);
    app.all(prefix, (c) => forward(c, Deno.env.get(envKey) ?? "", prefix));
    app.all(`${prefix}/*`, (c) => forward(c, Deno.env.get(envKey) ?? "", prefix));
  }

  app.notFound((c) => c.json({ error: "not found", code: "NOT_FOUND" }, 404));
  app.onError((err, c) => c.json({ error: String(err), code: "INTERNAL" }, 500));

  return app;
}
