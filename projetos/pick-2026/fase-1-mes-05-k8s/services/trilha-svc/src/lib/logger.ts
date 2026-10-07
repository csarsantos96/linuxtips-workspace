// Logger estruturado JSON.

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): number {
  const raw = (Deno.env.get("LOG_LEVEL") ?? "info").toLowerCase() as Level;
  return LEVELS[raw] ?? LEVELS.info;
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (LEVELS[level] < currentLevel()) return;
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: Deno.env.get("SERVICE_NAME") ?? "trilha-svc",
    msg,
    ...(ctx ?? {}),
  }));
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
};
