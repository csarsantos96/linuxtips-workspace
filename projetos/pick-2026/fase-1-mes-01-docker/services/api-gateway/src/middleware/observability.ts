// Logger + middleware de observabilidade do gateway.

import type { MiddlewareHandler } from "hono";
import { httpRequestDurationSeconds, httpRequestsTotal } from "../lib/prom.ts";

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
function currentLevel(): number {
  const env = (Deno.env.get("LOG_LEVEL") ?? "info").toLowerCase() as Level;
  return LEVELS[env] ?? LEVELS.info;
}
function emit(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < currentLevel()) return;
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    service: Deno.env.get("SERVICE_NAME") ?? "api-gateway",
    ...fields,
  }));
}
export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};

export const observability: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  const reqId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", reqId);
  c.res.headers.set("x-request-id", reqId);

  try {
    await next();
  } finally {
    const durMs = performance.now() - start;
    const status = String(c.res.status);
    const route = c.req.routePath || c.req.path;
    const labels = { method: c.req.method, route, status };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durMs / 1000);
    logger.info("http_request", {
      request_id: reqId,
      method: c.req.method,
      path: c.req.path,
      route,
      status,
      duration_ms: Math.round(durMs * 100) / 100,
    });
  }
};
