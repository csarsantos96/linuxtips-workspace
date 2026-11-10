// Entry point do api-gateway.

import { healthcheck } from "./healthcheck.ts";
import { createApp } from "./app.ts";
import { logger } from "./middleware/observability.ts";

const port = Number(Deno.env.get("PORT") ?? 8080);

// Probe do binário distroless: não inicia servidor nem executa migrations.
if (Deno.args.includes("--healthcheck")) {
  Deno.exit(await healthcheck(port) ? 0 : 1);
}

const app = createApp();

Deno.serve({
  port,
  onListen: ({ hostname, port }) => {
    logger.info("api-gateway listening", { hostname, port });
  },
}, app.fetch);
