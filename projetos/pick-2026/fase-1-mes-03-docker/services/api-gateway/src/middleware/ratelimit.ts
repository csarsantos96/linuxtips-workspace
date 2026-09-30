// Rate limit por IP, sliding window.
// Backend: Redis se REDIS_URL estiver setado; caso contrário, fallback in-memory.
// O fallback é per-pod — em produção, prefira sempre Redis (estado global).

import type { MiddlewareHandler } from "hono";
import { rateLimitRejectedTotal } from "../lib/prom.ts";

interface Limiter {
  hit(key: string, windowSec: number, max: number): Promise<{ allowed: boolean; remaining: number }>;
}

class MemoryLimiter implements Limiter {
  private buckets = new Map<string, number[]>();
  async hit(key: string, windowSec: number, max: number) {
    const now = Date.now();
    const cutoff = now - windowSec * 1000;
    const arr = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= max) {
      this.buckets.set(key, arr);
      return { allowed: false, remaining: 0 };
    }
    arr.push(now);
    this.buckets.set(key, arr);
    return { allowed: true, remaining: Math.max(0, max - arr.length) };
  }
}

// Redis: implementação RESP minimalista usando Deno.connect, evita dependência externa.
// Faz ZADD + ZREMRANGEBYSCORE + ZCARD + EXPIRE em pipeline simples.
class RedisLimiter implements Limiter {
  private url: URL;
  constructor(url: string) {
    this.url = new URL(url);
  }
  private async send(cmds: string[][]): Promise<unknown[]> {
    const conn = await Deno.connect({
      hostname: this.url.hostname,
      port: Number(this.url.port || 6379),
    });
    try {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const parts: string[] = [];
      for (const c of cmds) {
        parts.push(`*${c.length}\r\n`);
        for (const a of c) parts.push(`$${a.length}\r\n${a}\r\n`);
      }
      await conn.write(enc.encode(parts.join("")));
      const buf = new Uint8Array(8192);
      const n = await conn.read(buf);
      const raw = dec.decode(buf.subarray(0, n ?? 0));
      // parser RESP super-básico: detecta inteiros e arrays
      return raw.split("\r\n").filter(Boolean);
    } finally {
      try { conn.close(); } catch { /* ignore */ }
    }
  }
  async hit(key: string, windowSec: number, max: number) {
    const now = Date.now();
    const cutoff = now - windowSec * 1000;
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const replies = await this.send([
        ["ZREMRANGEBYSCORE", key, "0", String(cutoff)],
        ["ZCARD", key],
        ["ZADD", key, String(now), member],
        ["EXPIRE", key, String(windowSec)],
      ]);
      // Pega o ZCARD (segunda resposta). RESP integers começam com ':'.
      const cardLine = replies.find((r) => typeof r === "string" && (r as string).startsWith(":"));
      const count = cardLine ? Number((cardLine as string).slice(1)) : 0;
      if (count >= max) {
        return { allowed: false, remaining: 0 };
      }
      return { allowed: true, remaining: Math.max(0, max - count - 1) };
    } catch {
      // Em caso de erro de Redis, "fail open" para não derrubar o tráfego.
      return { allowed: true, remaining: max };
    }
  }
}

let _limiter: Limiter | null = null;
function getLimiter(): Limiter {
  if (_limiter) return _limiter;
  const url = Deno.env.get("REDIS_URL");
  _limiter = url ? new RedisLimiter(url) : new MemoryLimiter();
  return _limiter;
}

function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
  // Em K8s, o gateway costuma ter X-Forwarded-For do Ingress.
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = c.req.header("x-real-ip");
  if (real) return real;
  // Deno.serve injeta connInfo via c.env, mas Hono não expõe direto; usa fallback.
  return "anonymous";
}

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const windowSec = Number(Deno.env.get("RATE_LIMIT_WINDOW_SECONDS") ?? 60);
  const max = Number(Deno.env.get("RATE_LIMIT_MAX") ?? 100);
  // Não aplica em probes / metrics.
  const p = c.req.path;
  if (p === "/healthz" || p === "/readyz" || p === "/metrics") {
    return await next();
  }
  const ip = clientIp(c);
  const key = `gw:rl:${ip}`;
  const { allowed, remaining } = await getLimiter().hit(key, windowSec, max);
  c.res.headers.set("x-ratelimit-limit", String(max));
  c.res.headers.set("x-ratelimit-remaining", String(remaining));
  if (!allowed) {
    rateLimitRejectedTotal.inc({ ip });
    return c.json({ error: "rate limit excedido", code: "RATE_LIMITED" }, 429);
  }
  await next();
};
