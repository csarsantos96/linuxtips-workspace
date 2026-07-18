// Handlers de sessões de estudo.

import { Hono } from "hono";
import { and, count, desc, eq, gte, lte, sql as dsql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { studySessions } from "../db/schema.ts";
import { getAuth, requireAuth } from "../middleware/auth.ts";
import { focusSessionDurationSeconds, focusSessionsTotal } from "../lib/prom.ts";

interface StartBody {
  type?: string;
  duration_min?: number;
  note?: string;
}

interface EndBody {
  note?: string;
}

const VALID_TYPES = new Set(["pomodoro", "deep", "custom"]);

export function sessionsRoutes(db: Db) {
  const app = new Hono();
  app.use("*", requireAuth);

  app.post("/sessions/start", async (c) => {
    const { userId, tenantId } = getAuth(c);
    let body: StartBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json", code: "bad_request" }, 400);
    }
    const type = body.type ?? "pomodoro";
    if (!VALID_TYPES.has(type)) {
      return c.json({ error: "invalid type", code: "bad_request" }, 400);
    }
    const durationMin = Number(body.duration_min ?? 25);
    if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 600) {
      return c.json({ error: "invalid duration_min", code: "bad_request" }, 400);
    }
    const plannedS = Math.round(durationMin * 60);
    const [row] = await db
      .insert(studySessions)
      .values({
        tenantId,
        userId,
        type,
        plannedDurationS: plannedS,
        status: "active",
        note: body.note ?? null,
      })
      .returning();
    focusSessionsTotal.inc({ status: "started", type });
    return c.json(row, 201);
  });

  app.post("/sessions/:id/end", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    let body: EndBody = {};
    try {
      body = await c.req.json();
    } catch {
      /* body opcional */
    }
    const [existing] = await db
      .select()
      .from(studySessions)
      .where(
        and(
          eq(studySessions.id, id),
          eq(studySessions.userId, userId),
          eq(studySessions.tenantId, tenantId),
        ),
      );
    if (!existing) return c.json({ error: "not found", code: "not_found" }, 404);
    if (existing.status !== "active") {
      return c.json({ error: "session not active", code: "conflict" }, 409);
    }
    const now = new Date();
    const actualS = Math.max(
      0,
      Math.floor((now.getTime() - new Date(existing.startedAt!).getTime()) / 1000),
    );
    const [updated] = await db
      .update(studySessions)
      .set({
        status: "completed",
        endedAt: now,
        actualDurationS: actualS,
        note: body.note ?? existing.note,
      })
      .where(eq(studySessions.id, id))
      .returning();
    focusSessionsTotal.inc({ status: "completed", type: existing.type });
    focusSessionDurationSeconds.observe({ type: existing.type }, actualS);
    return c.json(updated);
  });

  app.post("/sessions/:id/abandon", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const id = c.req.param("id");
    const [existing] = await db
      .select()
      .from(studySessions)
      .where(
        and(
          eq(studySessions.id, id),
          eq(studySessions.userId, userId),
          eq(studySessions.tenantId, tenantId),
        ),
      );
    if (!existing) return c.json({ error: "not found", code: "not_found" }, 404);
    if (existing.status !== "active") {
      return c.json({ error: "session not active", code: "conflict" }, 409);
    }
    const now = new Date();
    const actualS = Math.max(
      0,
      Math.floor((now.getTime() - new Date(existing.startedAt!).getTime()) / 1000),
    );
    const [updated] = await db
      .update(studySessions)
      .set({ status: "abandoned", endedAt: now, actualDurationS: actualS })
      .where(eq(studySessions.id, id))
      .returning();
    focusSessionsTotal.inc({ status: "abandoned", type: existing.type });
    return c.json(updated);
  });

  app.get("/sessions", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const fromQ = c.req.query("from");
    const toQ = c.req.query("to");
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
    const filters = [eq(studySessions.userId, userId), eq(studySessions.tenantId, tenantId)];
    if (fromQ) {
      const d = new Date(fromQ);
      if (!isNaN(d.getTime())) filters.push(gte(studySessions.startedAt, d));
    }
    if (toQ) {
      const d = new Date(toQ);
      if (!isNaN(d.getTime())) filters.push(lte(studySessions.startedAt, d));
    }
    const rows = await db
      .select()
      .from(studySessions)
      .where(and(...filters))
      .orderBy(desc(studySessions.startedAt))
      .limit(limit)
      .offset(offset);
    // Conta total para o frontend paginar. Drizzle: count() retorna number como string em pg.
    const totalRows = await db
      .select({ n: count() })
      .from(studySessions)
      .where(and(...filters));
    const total = Number(totalRows[0]?.n ?? 0);
    return c.json({ items: rows, total });
  });

  // GET /sessions/today — sessões iniciadas hoje (UTC) do usuário corrente.
  // Conveniência para a home/dashboard — evita o front montar `from`/`to`.
  app.get("/sessions/today", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const result = await db.execute(dsql`
      SELECT *
      FROM focus.study_sessions
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND DATE(started_at AT TIME ZONE 'UTC') = DATE(now() AT TIME ZONE 'UTC')
      ORDER BY started_at DESC
    `);
    const rows = result as unknown as Array<Record<string, unknown>>;
    return c.json({ items: rows });
  });

  app.get("/stats/streak", async (c) => {
    const { userId, tenantId } = getAuth(c);
    // Pega os dias distintos (UTC date) com pelo menos 1 sessão completa, em ordem decrescente.
    const result = await db.execute(dsql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') AS d
      FROM focus.study_sessions
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status = 'completed'
      GROUP BY 1
      ORDER BY 1 DESC
    `);
    const rows = result as unknown as Array<{ d: string | Date }>;
    const dayStrs = rows.map((r) => {
      const d = r.d instanceof Date ? r.d : new Date(r.d);
      return d.toISOString().slice(0, 10);
    });
    let current = 0;
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    // current: começa hoje (UTC) ou ontem; conta dias consecutivos para trás.
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const ySet = new Set(dayStrs);
    {
      const cur = new Date(todayStr + "T00:00:00Z");
      if (!ySet.has(todayStr)) cur.setUTCDate(cur.getUTCDate() - 1);
      while (ySet.has(cur.toISOString().slice(0, 10))) {
        current++;
        cur.setUTCDate(cur.getUTCDate() - 1);
      }
    }
    // longest: percorrer em ordem crescente.
    const asc = [...dayStrs].sort();
    for (const ds of asc) {
      const d = new Date(ds + "T00:00:00Z");
      if (prev) {
        const diff = (d.getTime() - prev.getTime()) / 86400000;
        run = diff === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
      prev = d;
    }
    const lastRow = await db
      .select()
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.tenantId, tenantId),
          eq(studySessions.status, "completed"),
        ),
      )
      .orderBy(desc(studySessions.startedAt))
      .limit(1);
    return c.json({
      current_days: current,
      longest_days: longest,
      last_session_at: lastRow[0]?.startedAt ?? null,
    });
  });

  app.get("/stats/heatmap", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const days = Math.min(Math.max(Number(c.req.query("days") ?? 90), 1), 365);
    const result = await db.execute(dsql`
      SELECT
        TO_CHAR(DATE(started_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
        COALESCE(SUM(COALESCE(actual_duration_s, planned_duration_s)), 0)::int AS total_seconds,
        COUNT(*)::int AS session_count
      FROM focus.study_sessions
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status = 'completed'
        AND started_at >= now() - (${days}::int * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    const rows = result as unknown as Array<
      { date: string; total_seconds: number; session_count: number }
    >;
    return c.json(
      rows.map((r) => ({
        date: r.date,
        total_minutes: Math.round(r.total_seconds / 60),
        session_count: r.session_count,
      })),
    );
  });

  app.get("/stats/today", async (c) => {
    const { userId, tenantId } = getAuth(c);
    const goal = Number(Deno.env.get("DAILY_GOAL_MIN") ?? 50);
    const result = await db.execute(dsql`
      SELECT
        COUNT(*)::int AS sessions_today,
        COALESCE(SUM(COALESCE(actual_duration_s, planned_duration_s)), 0)::int AS total_seconds
      FROM focus.study_sessions
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status = 'completed'
        AND DATE(started_at AT TIME ZONE 'UTC') = DATE(now() AT TIME ZONE 'UTC')
    `);
    const row =
      (result as unknown as Array<{ sessions_today: number; total_seconds: number }>)[0] ??
        { sessions_today: 0, total_seconds: 0 };
    const minutesToday = Math.round(row.total_seconds / 60);
    const pct = goal > 0 ? Math.min(100, Math.round((minutesToday / goal) * 100)) : 0;
    return c.json({
      sessions_today: row.sessions_today,
      minutes_today: minutesToday,
      daily_goal_min: goal,
      goal_pct: pct,
    });
  });

  return app;
}
