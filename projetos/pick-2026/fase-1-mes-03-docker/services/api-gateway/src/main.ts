// Entry point do api-gateway.

import { createApp } from "./app.ts";
import { logger } from "./middleware/observability.ts";

const port = Number(Deno.env.get("PORT") ?? 8080);
const app = createApp();

Deno.serve({
  port,
  onListen: ({ hostname, port }) => {
    logger.info("api-gateway listening", { hostname, port });
  },
}, app.fetch);
