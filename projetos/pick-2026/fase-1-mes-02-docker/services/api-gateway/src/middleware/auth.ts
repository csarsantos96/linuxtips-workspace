// Middleware de autenticação: chama POST {AUTH_SVC_URL}/auth/verify e
// guarda resultado em cache em memória por VERIFY_CACHE_TTL_SECONDS.

import type { MiddlewareHandler } from "hono";
import { logger } from "./observability.ts";

interface VerifyResult {
  valid: boolean;
  user_id?: string;
  tenant_id?: string;
  reason?: string;
}

interface CacheEntry {
  res: VerifyResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheTtlMs(): number {
  return Number(Deno.env.get("VERIFY_CACHE_TTL_SECONDS") ?? 60) * 1000;
}

async function verifyToken(token: string): Promise<VerifyResult> {
  const now = Date.now();
  const hit = cache.get(token);
  if (hit && hit.expiresAt > now) return hit.res;

  const authUrl = Deno.env.get("AUTH_SVC_URL");
  if (!authUrl) {
    logger.error("AUTH_SVC_URL não configurada");
    return { valid: false, reason: "auth_svc_unconfigured" };
  }

  const timeoutMs = Number(Deno.env.get("UPSTREAM_TIMEOUT_MS") ?? 15000);
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${authUrl}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      return { valid: false, reason: `auth_svc_status_${r.status}` };
    }
    const data = (await r.json()) as VerifyResult;
    cache.set(token, { res: data, expiresAt: now + cacheTtlMs() });
    return data;
  } catch (e) {
    logger.warn("verify_failed", { error: String(e) });
    return { valid: false, reason: "auth_svc_unreachable" };
  } finally {
    clearTimeout(tm);
  }
}

/** Limpa cache (uso em testes). */
export function _resetVerifyCache() {
  cache.clear();
}

/** Middleware que valida JWT e injeta x-user-id / x-tenant-id. */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authH = c.req.header("authorization") ?? "";
  const m = authH.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return c.json({ error: "token ausente", code: "MISSING_TOKEN" }, 401);
  }
  const res = await verifyToken(m[1]);
  if (!res.valid || !res.user_id || !res.tenant_id) {
    return c.json({ error: "token inválido", code: "INVALID_TOKEN" }, 401);
  }
  c.set("userId", res.user_id);
  c.set("tenantId", res.tenant_id);
  await next();
};
