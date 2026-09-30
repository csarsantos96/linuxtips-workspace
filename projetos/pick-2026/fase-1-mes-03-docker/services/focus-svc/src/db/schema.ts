// Schema Drizzle do focus-svc — schema lógico `focus` no Postgres.

import { integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const focusSchema = pgSchema("focus");

export const studySessions = focusSchema.table("study_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  type: text("type").notNull(),
  plannedDurationS: integer("planned_duration_s").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  actualDurationS: integer("actual_duration_s"),
  status: text("status").notNull().default("active"),
  note: text("note"),
});

export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
