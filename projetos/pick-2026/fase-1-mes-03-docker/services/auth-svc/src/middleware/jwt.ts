// Helpers de assinatura/verificação de JWT (HS256 via djwt).
// O segredo vem de JWT_SECRET. Em produção, trocar para RS256 (par em Secret K8s).

import { create, verify, getNumericDate, type Payload } from "djwt";

export interface AuthClaims extends Payload {
  sub: string; // user_id
  tnt: string; // tenant_id
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

let _key: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (_key) return _key;
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET ausente ou muito curto (mín. 16 chars)");
  }
  _key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return _key;
}

const ACCESS_TTL = () => Number(Deno.env.get("ACCESS_TOKEN_TTL_SECONDS") ?? 900);

export async function signAccessToken(userId: string, tenantId: string): Promise<string> {
  const key = await getKey();
  const now = Math.floor(Date.now() / 1000);
  const claims: AuthClaims = {
    sub: userId,
    tnt: tenantId,
    iat: now,
    exp: getNumericDate(ACCESS_TTL()),
    iss: Deno.env.get("JWT_ISSUER") ?? "pickstack",
    aud: Deno.env.get("JWT_AUDIENCE") ?? "pickstack",
  };
  return await create({ alg: "HS256", typ: "JWT" }, claims, key);
}

export async function verifyAccessToken(token: string): Promise<AuthClaims> {
  const key = await getKey();
  const payload = (await verify(token, key)) as AuthClaims;
  if (!payload.sub || !payload.tnt) {
    throw new Error("token sem claims obrigatórios");
  }
  return payload;
}
