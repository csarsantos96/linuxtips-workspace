// Logger estruturado + middleware de métricas/log de requisições.
// Saída JSON em stdout, compatível com Loki/Promtail.

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
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    service: Deno.env.get("SERVICE_NAME") ?? "auth-svc",
    ...fields,
  });
  console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

function newRequestId(): string {
  return crypto.randomUUID();
}

/** Middleware Hono: injeta request_id, mede duração, loga e atualiza métricas. */
export const observability: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  const reqId = c.req.header("x-request-id") ?? newRequestId();
  c.set("requestId", reqId);
  c.res.headers.set("x-request-id", reqId);

  let err: unknown = null;
  try {
    await next();
  } catch (e) {
    err = e;
    throw e;
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
      ...(err ? { error: String(err) } : {}),
    });
  }
};
