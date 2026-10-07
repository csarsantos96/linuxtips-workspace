import type { MiddlewareHandler } from "hono";
import { logger } from "../lib/logger.ts";
import { httpRequestDurationSeconds, httpRequestsTotal } from "../lib/prom.ts";

export { logger };

export const observability: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;
  const route = c.req.routePath ?? c.req.path;
  const labels = { method: c.req.method, route, status: String(c.res.status) };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, duration / 1000);
  logger.info("http_request", {
    method: c.req.method,
    path: c.req.path,
    route,
    status: c.res.status,
    duration_ms: Math.round(duration * 100) / 100,
  });
};
