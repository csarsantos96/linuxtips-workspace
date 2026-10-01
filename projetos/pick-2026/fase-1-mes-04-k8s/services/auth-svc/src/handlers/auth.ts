// Handlers de autenticação: signup, login, refresh, me, verify.
// Tudo isolado para facilitar testes — recebe `db` via factory.

import type { Context, Hono } from "hono";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import type { Db } from "../db/client.ts";
import { refreshTokens, tenants, users } from "../db/schema.ts";
import { signAccessToken, verifyAccessToken } from "../middleware/jwt.ts";
import { logger } from "../middleware/observability.ts";

const BCRYPT_ROUNDS = 10;

function err(c: Context, status: number, code: string, message: string) {
  return c.json({ error: message, code }, status as 400 | 401 | 404 | 409 | 500);
}

function userPublic(u: { id: string; email: string; name: string | null; tenantId: string }) {
  return { id: u.id, email: u.email, name: u.name, tenant_id: u.tenantId };
}

function refreshTokenTtlMs(): number {
  return Number(Deno.env.get("REFRESH_TOKEN_TTL_SECONDS") ?? 30 * 24 * 3600) * 1000;
}

async function hashRefresh(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrCreateTenant(db: Db, slug: string, name: string): Promise<string> {
  const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (existing.length > 0) return existing[0].id;
  const [row] = await db.insert(tenants).values({ slug, name }).returning({ id: tenants.id });
  return row.id;
}

export function registerAuthRoutes(app: Hono, db: Db) {
  // POST /auth/signup
  app.post("/auth/signup", async (c) => {
    let body: { email?: string; password?: string; name?: string; tenant_slug?: string };
    try {
      body = await c.req.json();
    } catch {
      return err(c, 400, "INVALID_JSON", "body inválido");
    }
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return err(c, 400, "MISSING_FIELDS", "email e password são obrigatórios");
    }
    if (password.length < 8) {
      return err(c, 400, "WEAK_PASSWORD", "password precisa ter ao menos 8 caracteres");
    }

    let tenantId: string;
    if (body.tenant_slug) {
      tenantId = await getOrCreateTenant(db, body.tenant_slug, body.tenant_slug);
    } else {
      const slug = `user-${crypto.randomUUID().slice(0, 8)}`;
      tenantId = await getOrCreateTenant(db, slug, slug);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let user: { id: string; email: string; name: string | null; tenantId: string };
    try {
      const [row] = await db
        .insert(users)
        .values({ tenantId, email, passwordHash, name: body.name ?? null })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          tenantId: users.tenantId,
        });
      user = row;
    } catch (e) {
      const msg = String(e);
      if (msg.includes("users_tenant_email_uq") || msg.includes("duplicate key")) {
        return err(c, 409, "EMAIL_TAKEN", "email já cadastrado para este tenant");
      }
      logger.error("signup_failed", { error: msg });
      return err(c, 500, "INTERNAL", "erro interno");
    }

    const token = await signAccessToken(user.id, user.tenantId);
    const refresh = newRefreshToken();
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: await hashRefresh(refresh),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    });

    return c.json(
      { user: userPublic(user), token, refresh_token: refresh },
      201,
    );
  });

  // POST /auth/login
  app.post("/auth/login", async (c) => {
    let body: { email?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return err(c, 400, "INVALID_JSON", "body inválido");
    }
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return err(c, 400, "MISSING_FIELDS", "email e password são obrigatórios");
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        tenantId: users.tenantId,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (rows.length === 0) {
      return err(c, 401, "INVALID_CREDENTIALS", "credenciais inválidas");
    }
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      return err(c, 401, "INVALID_CREDENTIALS", "credenciais inválidas");
    }

    const token = await signAccessToken(u.id, u.tenantId);
    const refresh = newRefreshToken();
    await db.insert(refreshTokens).values({
      userId: u.id,
      tokenHash: await hashRefresh(refresh),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    });

    return c.json({ user: userPublic(u), token, refresh_token: refresh });
  });

  // POST /auth/refresh — rotaciona refresh token.
  app.post("/auth/refresh", async (c) => {
    let body: { refresh_token?: string };
    try {
      body = await c.req.json();
    } catch {
      return err(c, 400, "INVALID_JSON", "body inválido");
    }
    const raw = body.refresh_token ?? "";
    if (!raw) return err(c, 400, "MISSING_FIELDS", "refresh_token é obrigatório");

    const hash = await hashRefresh(raw);
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1);
    if (rows.length === 0) {
      return err(c, 401, "INVALID_REFRESH", "refresh token inválido");
    }
    const rt = rows[0];
    if (rt.revokedAt) {
      return err(c, 401, "REVOKED_REFRESH", "refresh token revogado");
    }
    if (new Date(rt.expiresAt).getTime() < Date.now()) {
      return err(c, 401, "EXPIRED_REFRESH", "refresh token expirado");
    }

    const userRows = await db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, rt.userId))
      .limit(1);
    if (userRows.length === 0) {
      return err(c, 401, "INVALID_REFRESH", "refresh token inválido");
    }
    const u = userRows[0];

    // Revoga o atual e cria novo (rotação).
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, rt.id));

    const token = await signAccessToken(u.id, u.tenantId);
    const newRaw = newRefreshToken();
    await db.insert(refreshTokens).values({
      userId: u.id,
      tokenHash: await hashRefresh(newRaw),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    });

    return c.json({ token, refresh_token: newRaw });
  });

  // GET /auth/me
  app.get("/auth/me", async (c) => {
    const authH = c.req.header("authorization") ?? "";
    const m = authH.match(/^Bearer\s+(.+)$/i);
    if (!m) return err(c, 401, "MISSING_TOKEN", "Authorization Bearer ausente");

    try {
      const claims = await verifyAccessToken(m[1]);
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(and(eq(users.id, claims.sub), eq(users.tenantId, claims.tnt)))
        .limit(1);
      if (rows.length === 0) return err(c, 401, "USER_NOT_FOUND", "usuário não encontrado");
      return c.json({ user: userPublic(rows[0]) });
    } catch (_e) {
      return err(c, 401, "INVALID_TOKEN", "token inválido");
    }
  });

  // POST /auth/logout — revoga o refresh token informado.
  // Idempotente: refresh inválido/já revogado retorna 204 (não vaza estado da sessão).
  app.post("/auth/logout", async (c) => {
    let body: { refresh_token?: string };
    try {
      body = await c.req.json();
    } catch {
      return err(c, 400, "INVALID_JSON", "body inválido");
    }
    const raw = body.refresh_token ?? "";
    if (!raw) return err(c, 400, "MISSING_FIELDS", "refresh_token é obrigatório");

    const hash = await hashRefresh(raw);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hash));
    return c.body(null, 204);
  });

  // POST /auth/password — troca senha do usuário autenticado (Bearer).
  // Body: { old_password, new_password }.
  app.post("/auth/password", async (c) => {
    const authH = c.req.header("authorization") ?? "";
    const m = authH.match(/^Bearer\s+(.+)$/i);
    if (!m) return err(c, 401, "MISSING_TOKEN", "Authorization Bearer ausente");

    let claims: { sub: string; tnt: string };
    try {
      claims = await verifyAccessToken(m[1]);
    } catch {
      return err(c, 401, "INVALID_TOKEN", "token inválido");
    }

    let body: { old_password?: string; new_password?: string };
    try {
      body = await c.req.json();
    } catch {
      return err(c, 400, "INVALID_JSON", "body inválido");
    }
    const oldPwd = body.old_password ?? "";
    const newPwd = body.new_password ?? "";
    if (!oldPwd || !newPwd) {
      return err(c, 400, "MISSING_FIELDS", "old_password e new_password são obrigatórios");
    }
    if (newPwd.length < 8) {
      return err(c, 400, "WEAK_PASSWORD", "new_password precisa ter ao menos 8 caracteres");
    }

    const rows = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(eq(users.id, claims.sub), eq(users.tenantId, claims.tnt)))
      .limit(1);
    if (rows.length === 0) {
      return err(c, 401, "USER_NOT_FOUND", "usuário não encontrado");
    }
    const u = rows[0];
    const ok = await bcrypt.compare(oldPwd, u.passwordHash);
    if (!ok) {
      return err(c, 401, "INVALID_CREDENTIALS", "senha atual incorreta");
    }
    const newHash = await bcrypt.hash(newPwd, BCRYPT_ROUNDS);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, u.id));
    // Revoga todos os refresh tokens ativos do usuário (boa prática de segurança).
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, u.id));
    return c.body(null, 204);
  });

  // POST /auth/verify — usado pelo gateway. Sempre 200; campo `valid` indica.
  app.post("/auth/verify", async (c) => {
    let body: { token?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ valid: false, reason: "invalid_json" });
    }
    const tok = body.token ?? "";
    if (!tok) return c.json({ valid: false, reason: "missing_token" });
    try {
      const claims = await verifyAccessToken(tok);
      return c.json({ valid: true, user_id: claims.sub, tenant_id: claims.tnt });
    } catch (e) {
      return c.json({ valid: false, reason: String((e as Error).message ?? e) });
    }
  });
}
