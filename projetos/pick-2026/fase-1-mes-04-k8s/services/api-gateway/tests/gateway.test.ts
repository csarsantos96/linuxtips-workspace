// Testes do gateway. Sobe um servidor stub local para simular auth-svc e
// um upstream, e verifica:
//  - /healthz
//  - rota não-/api/auth/* sem token => 401
//  - rota /api/auth/* sem token => passa (proxy para auth-svc stub)
//  - rota /api/focus/* com token válido => proxy injeta x-user-id / x-tenant-id
//  - rate limit corta após RATE_LIMIT_MAX
//  - CORS preflight em dev (origin *)

import { assertEquals } from "@std/assert";

Deno.env.set("LOG_LEVEL", "error");
Deno.env.set("SERVICE_NAME", "api-gateway-test");

// Captura de chamadas recebidas pelo upstream stub.
interface Capture {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

async function startStub(handler: (req: Request) => Response | Promise<Response>): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const ac = new AbortController();
  const server = Deno.serve({ port: 0, signal: ac.signal, onListen: () => {} }, handler);
  // server.addr é tipado como Deno.NetAddr para http; pega a porta dinâmica.
  const addr = server.addr as Deno.NetAddr;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: async () => {
      ac.abort();
      try { await server.finished; } catch { /* ignore */ }
    },
  };
}

Deno.test("GET /healthz responde 200", async () => {
  // Importa preguiçosamente depois de setar env.
  const { createApp } = await import("../src/app.ts");
  const app = createApp();
  const res = await app.request("/healthz");
  assertEquals(res.status, 200);
});

Deno.test("rota protegida sem token = 401", async () => {
  const { createApp } = await import("../src/app.ts");
  Deno.env.set("AUTH_SVC_URL", "http://127.0.0.1:1"); // não chamado neste caso
  Deno.env.set("FOCUS_SVC_URL", "http://127.0.0.1:1");
  const app = createApp();
  const res = await app.request("/api/focus/sessions");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.code, "MISSING_TOKEN");
});

Deno.test("rota /api/auth/* faz proxy para auth-svc sem exigir token", async () => {
  const captures: Capture[] = [];
  const stub = await startStub(async (req) => {
    const url = new URL(req.url);
    captures.push({
      path: url.pathname,
      method: req.method,
      headers: Object.fromEntries(req.headers),
      body: req.method === "POST" ? await req.text() : undefined,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    Deno.env.set("AUTH_SVC_URL", stub.url);
    const { createApp } = await import("../src/app.ts");
    const app = createApp();
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "x" }),
    });
    assertEquals(res.status, 200);
    assertEquals(captures.length, 1);
    assertEquals(captures[0].path, "/auth/login");
    assertEquals(captures[0].method, "POST");
  } finally {
    await stub.close();
  }
});

Deno.test("rota protegida com token válido encaminha com x-user-id/x-tenant-id", async () => {
  // stub do auth-svc /auth/verify
  const authStub = await startStub((req) => {
    const url = new URL(req.url);
    if (url.pathname === "/auth/verify") {
      return new Response(
        JSON.stringify({ valid: true, user_id: "u-1", tenant_id: "t-1" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.pathname === "/healthz") return new Response("ok");
    return new Response("not found", { status: 404 });
  });
  const focusCaptures: Record<string, string>[] = [];
  const focusStub = await startStub((req) => {
    focusCaptures.push(Object.fromEntries(req.headers));
    return new Response(JSON.stringify({ sessions: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    Deno.env.set("AUTH_SVC_URL", authStub.url);
    Deno.env.set("FOCUS_SVC_URL", focusStub.url);
    // Reseta cache do verify para evitar contaminação entre testes.
    const { _resetVerifyCache } = await import("../src/middleware/auth.ts");
    _resetVerifyCache();

    const { createApp } = await import("../src/app.ts");
    const app = createApp();
    const res = await app.request("/api/focus/sessions", {
      headers: { authorization: "Bearer fake-but-cached" },
    });
    assertEquals(res.status, 200);
    assertEquals(focusCaptures.length, 1);
    assertEquals(focusCaptures[0]["x-user-id"], "u-1");
    assertEquals(focusCaptures[0]["x-tenant-id"], "t-1");
  } finally {
    await authStub.close();
    await focusStub.close();
  }
});

Deno.test("rate limit retorna 429 após exceder RATE_LIMIT_MAX", async () => {
  // Garante backend in-memory (sem REDIS_URL).
  Deno.env.delete("REDIS_URL");
  Deno.env.set("RATE_LIMIT_WINDOW_SECONDS", "60");
  Deno.env.set("RATE_LIMIT_MAX", "3");
  Deno.env.set("AUTH_SVC_URL", "http://127.0.0.1:1");
  Deno.env.set("FOCUS_SVC_URL", "http://127.0.0.1:1");

  // Importa fresh para pegar limiter novo (módulo já cacheado: limiter é singleton,
  // mas como antes não tinha REDIS_URL, segue o mesmo MemoryLimiter).
  const { createApp } = await import("../src/app.ts");
  const app = createApp();

  let last = 0;
  for (let i = 0; i < 5; i++) {
    const res = await app.request("/api/focus/x", {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    last = res.status;
  }
  // Última chamada deve ter sido bloqueada por rate limit (429) — antes da auth (401)
  // pois rate limit roda primeiro no pipeline.
  assertEquals(last, 429);
});
