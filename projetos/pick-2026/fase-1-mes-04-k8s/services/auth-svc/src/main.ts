// Entry point do auth-svc.
// Lê env vars, opcionalmente roda migrations e sobe o servidor Hono.

import { healthcheck } from "./healthcheck.ts";
import { createApp } from "./app.ts";
import { getDb, runMigrations } from "./db/client.ts";
import { logger } from "./middleware/observability.ts";

const port = Number(Deno.env.get("PORT") ?? 8081);

// Probe do binário distroless: não inicia servidor nem executa migrations.
if (Deno.args.includes("--healthcheck")) {
  Deno.exit(await healthcheck(port) ? 0 : 1);
}

const runMig = (Deno.env.get("RUN_MIGRATIONS_ON_BOOT") ?? "true") === "true";

if (runMig) {
  try {
    await runMigrations();
    logger.info("migrations applied");
  } catch (err) {
    logger.error("migrations failed", { error: String(err) });
    // Não derruba o serviço — readyz vai falhar até que o DB esteja ok.
  }
}

const app = createApp({ db: getDb() });

Deno.serve({
  port,
  onListen: ({ hostname, port }) => {
    logger.info("auth-svc listening", { hostname, port });
  },
}, app.fetch);
