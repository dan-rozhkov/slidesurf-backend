import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { presentationPlans } from "./presentation-plans-schema";
import type { Slide } from "@/types";

export const presentations = pgTable("presentations", {
  // Basic fields
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  themeId: text("theme_id").notNull(),
  planId: text("plan_id").references(() => presentationPlans.id, {
    onDelete: "set null",
  }),

  // Store slides as JSON array
  slides: jsonb("slides").$type<Slide[]>().notNull().default([]),

  // Font size preset (S/M/L)
  fontSizePreset: text("font_size_preset"),

  // Новые столбцы
  isDeleted: boolean("is_deleted").notNull().default(false),
  isShared: boolean("is_shared").notNull().default(false),

  // Preview URL for presentation thumbnail
  previewUrl: text("preview_url"),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // User relation
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
