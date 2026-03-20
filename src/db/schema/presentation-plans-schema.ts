import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { Section } from "@/types";

export const presentationPlans = pgTable("presentation_plans", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slides: jsonb("slides").$type<Section[]>().notNull().default([]),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    language: text("language").notNull(),
    slidesCount: integer("slides_count").notNull(),
    research: text("research"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
