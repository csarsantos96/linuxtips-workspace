// Schema Drizzle do trilha-svc — schema lógico `trilha` no Postgres.

import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const trilhaSchema = pgSchema("trilha");

export const roadmaps = trilhaSchema.table("roadmaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const roadmapNodes = trilhaSchema.table("roadmap_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  roadmapId: uuid("roadmap_id").notNull().references(() => roadmaps.id, {
    onDelete: "cascade",
  }),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  dependsOn: text("depends_on").array(),
  // deno-lint-ignore no-explicit-any
  resources: jsonb("resources").$type<any>(),
  orderIndex: integer("order_index"),
});

export const userProgress = trilhaSchema.table("user_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  nodeId: uuid("node_id").notNull().references(() => roadmapNodes.id, {
    onDelete: "cascade",
  }),
  status: text("status").notNull().default("todo"),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Roadmap = typeof roadmaps.$inferSelect;
export type RoadmapNode = typeof roadmapNodes.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
