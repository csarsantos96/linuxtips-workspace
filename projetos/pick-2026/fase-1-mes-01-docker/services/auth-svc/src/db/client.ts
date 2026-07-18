// Conexão Postgres via postgres-js + Drizzle.
// Exporta `getDb()` singleton e `runMigrations()` (executa SQL bruto do diretório migrations).

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let _sql: postgres.Sql | null = null;
let _db: Db | null = null;

function getSql(): postgres.Sql {
  if (_sql) return _sql;
  const url = Deno.env.get("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL não configurada");
  }
  _sql = postgres(url, {
    max: Number(Deno.env.get("DB_POOL_MAX") ?? 10),
    idle_timeout: 30,
    prepare: false,
  });
  return _sql;
}

export function getDb(): Db {
  if (_db) return _db;
  _db = drizzle(getSql(), { schema });
  return _db;
}

/** Encerra a pool (usado por testes). */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
    _db = null;
  }
}

/** Aplica migrations SQL do diretório src/db/migrations em ordem alfabética. */
export async function runMigrations(): Promise<void> {
  const sql = getSql();
  const migDir = new URL(`file://${Deno.cwd()}/src/db/migrations/`);
  const files: string[] = [];
  for await (const e of Deno.readDir(migDir)) {
    if (e.isFile && e.name.endsWith(".sql")) files.push(e.name);
  }
  files.sort();
  for (const f of files) {
    const path = new URL(f, migDir);
    const content = await Deno.readTextFile(path);
    // postgres-js aceita SQL multi-statement via .unsafe()
    await sql.unsafe(content);
  }
}

/** Ping rápido pro readyz. */
export async function pingDb(): Promise<boolean> {
  try {
    await getSql()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
