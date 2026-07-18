// Entry point do trilha-svc.

import { createApp } from "./app.ts";
import { getDb, runMigrations } from "./db/client.ts";
import { seedDevopsRoadmap } from "./db/seeds/devops-roadmap.ts";
import { logger } from "./lib/logger.ts";

const port = Number(Deno.env.get("PORT") ?? 8084);
const runMig = (Deno.env.get("RUN_MIGRATIONS_ON_BOOT") ?? "true") === "true";
const seed = (Deno.env.get("SEED_DEFAULT_ROADMAP") ?? "true") === "true";

if (runMig) {
  try {
    await runMigrations();
    logger.info("migrations applied");
  } catch (err) {
    logger.error("migrations failed", { error: String(err) });
  }
}

if (seed) {
  try {
    await seedDevopsRoadmap(getDb());
  } catch (err) {
    logger.error("seed failed", { error: String(err) });
  }
}

const app = createApp({ db: getDb() });

Deno.serve({
  port,
  onListen: ({ hostname, port }) => {
    logger.info("trilha-svc listening", { hostname, port });
  },
}, app.fetch);
