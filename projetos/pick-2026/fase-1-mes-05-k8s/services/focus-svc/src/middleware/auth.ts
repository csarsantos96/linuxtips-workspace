// Lê headers x-user-id e x-tenant-id (injetados pelo api-gateway).
// Se algum faltar/inválido → 401.

import type { Context, MiddlewareHandler } from "hono";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthCtx {
  userId: string;
  tenantId: string;
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const userId = c.req.header("x-user-id");
  const tenantId = c.req.header("x-tenant-id");
  if (!userId || !tenantId || !UUID_RE.test(userId) || !UUID_RE.test(tenantId)) {
    return c.json({ error: "missing or invalid auth headers", code: "unauthorized" }, 401);
  }
  c.set("auth", { userId, tenantId } as AuthCtx);
  await next();
};

export function getAuth(c: Context): AuthCtx {
  return c.get("auth") as AuthCtx;
}
