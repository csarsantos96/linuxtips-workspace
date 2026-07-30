// Schema Drizzle do auth-svc — schema lógico `auth` no Postgres.

import { pgSchema, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

export const tenants = authSchema.table("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const users = authSchema.table(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    tenantEmailUq: unique("users_tenant_email_uq").on(t.tenantId, t.email),
  }),
);

export const refreshTokens = authSchema.table("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
