// Entry point do focus-svc.

import { createApp } from "./app.ts";
import { getDb, runMigrations } from "./db/client.ts";
import { logger } from "./lib/logger.ts";

const port = Number(Deno.env.get("PORT") ?? 8082);
const runMig = (Deno.env.get("RUN_MIGRATIONS_ON_BOOT") ?? "true") === "true";

if (runMig) {
  try {
    await runMigrations();
    logger.info("migrations applied");
  } catch (err) {
    logger.error("migrations failed", { error: String(err) });
  }
}

const app = createApp({ db: getDb() });

Deno.serve({
  port,
  onListen: ({ hostname, port }) => {
    logger.info("focus-svc listening", { hostname, port });
  },
}, app.fetch);
