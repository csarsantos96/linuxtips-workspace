// Schema Drizzle do cards-svc — schema lógico `cards` no Postgres.

import {
  boolean,
  integer,
  pgSchema,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const cardsSchema = pgSchema("cards");

export const decks = cardsSchema.table("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const cards = cardsSchema.table("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  tags: text("tags").array(),
  easiness: real("easiness").notNull().default(2.5),
  intervalDays: integer("interval_days").notNull().default(0),
  repetitions: integer("repetitions").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const reviews = cardsSchema.table("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  quality: smallint("quality").notNull(),
  prevEasiness: real("prev_easiness").notNull(),
  nextEasiness: real("next_easiness").notNull(),
  nextIntervalDays: integer("next_interval_days").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow(),
});

export type Deck = typeof decks.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Review = typeof reviews.$inferSelect;
