import { assertEquals } from "@std/assert";
import { healthcheck } from "../src/healthcheck.ts";

Deno.test("healthcheck respeita status HTTP e caminho /healthz", async () => {
  let status = 200;
  let path = "";
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, (req) => {
    path = new URL(req.url).pathname;
    return new Response("probe", { status });
  });
  try {
    assertEquals(await healthcheck(server.addr.port), true);
    assertEquals(path, "/healthz");
    status = 503;
    assertEquals(await healthcheck(server.addr.port), false);
  } finally {
    await server.shutdown();
  }
  assertEquals(await healthcheck(server.addr.port), false);
});

Deno.test("healthcheck encerra quando o servidor não responde", async () => {
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new Response("late");
  });
  try {
    assertEquals(await healthcheck(server.addr.port, 20), false);
  } finally {
    await server.shutdown();
  }
});
