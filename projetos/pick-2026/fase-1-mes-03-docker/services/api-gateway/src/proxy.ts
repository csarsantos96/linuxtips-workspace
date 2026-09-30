// Proxy reverso: stripa o prefixo `/api/<svc>` e encaminha para o upstream,
// injetando x-user-id, x-tenant-id e x-request-id quando disponíveis.

import type { Context } from "hono";
import { logger } from "./middleware/observability.ts";
import { upstreamRequestsTotal } from "./lib/prom.ts";

/** Encaminha a request atual para `upstreamBase`, removendo `prefix` do path. */
export async function forward(c: Context, upstreamBase: string, prefix: string): Promise<Response> {
  if (!upstreamBase) {
    return c.json({ error: "upstream não configurado", code: "UPSTREAM_UNCONFIGURED" }, 502);
  }
  const incoming = new URL(c.req.url);
  const subpath = incoming.pathname.startsWith(prefix)
    ? incoming.pathname.slice(prefix.length) || "/"
    : incoming.pathname;
  const target = new URL(upstreamBase);
  // Junta o path do upstream + subpath sem duplicar barras.
  target.pathname = `${target.pathname.replace(/\/$/, "")}${
    subpath.startsWith("/") ? "" : "/"
  }${subpath}`;
  target.search = incoming.search;

  // Filtra/ajusta headers.
  const headers = new Headers();
  c.req.raw.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === "host" || lk === "content-length") return;
    headers.set(k, v);
  });
  const userId = c.get("userId") as string | undefined;
  const tenantId = c.get("tenantId") as string | undefined;
  const reqId = c.get("requestId") as string | undefined;
  if (userId) headers.set("x-user-id", userId);
  if (tenantId) headers.set("x-tenant-id", tenantId);
  if (reqId) headers.set("x-request-id", reqId);
  // Cabeçalho útil para observabilidade nos upstreams.
  headers.set("x-forwarded-by", "pickstack-api-gateway");

  const timeoutMs = Number(Deno.env.get("UPSTREAM_TIMEOUT_MS") ?? 15000);
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);

  const method = c.req.method;
  const hasBody = !["GET", "HEAD"].includes(method);

  try {
    const upstreamRes = await fetch(target.toString(), {
      method,
      headers,
      body: hasBody ? c.req.raw.body : undefined,
      signal: ctrl.signal,
      // Necessário para streams em Deno fetch.
      ...(hasBody ? { duplex: "half" } : {}),
    } as RequestInit);

    upstreamRequestsTotal.inc({
      upstream: new URL(upstreamBase).host,
      status: String(upstreamRes.status),
    });

    // Repassa headers e body como stream.
    const respHeaders = new Headers(upstreamRes.headers);
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: respHeaders,
    });
  } catch (e) {
    logger.warn("upstream_error", { upstream: upstreamBase, error: String(e) });
    upstreamRequestsTotal.inc({
      upstream: new URL(upstreamBase).host,
      status: "error",
    });
    return c.json(
      { error: "upstream indisponível", code: "UPSTREAM_UNAVAILABLE" },
      502,
    );
  } finally {
    clearTimeout(tm);
  }
}
