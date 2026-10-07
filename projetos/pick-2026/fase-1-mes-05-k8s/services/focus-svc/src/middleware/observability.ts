// Middleware: log JSON + métricas Prometheus por request.

import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger.ts";
import { httpRequestDurationSeconds, httpRequestsTotal } from "../lib/prom.ts";

export { logger };

export const observability: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const durationMs = performance.now() - start;
  const route = c.req.routePath ?? c.req.path;
  const labels = {
    method: c.req.method,
    route,
    status: String(c.res.status),
  };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, durationMs / 1000);
  logger.info("http_request", {
    method: c.req.method,
    path: c.req.path,
    route,
    status: c.res.status,
    duration_ms: Math.round(durationMs * 100) / 100,
  });
};
