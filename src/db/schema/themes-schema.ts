import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import type { ThemeColors } from "@/types";

// Type for theme assets
type ThemeAssets = {
  backgroundImageUrl?: string[];
  imageUrl?: string[];
};

// Type for font weights
type FontWeights = {
  normal: number;
  bold: number;
};

export const themes = pgTable(
  "themes",
  {
    // Basic fields
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    previewUrl: text("preview_url").notNull(),

    // Theme configuration
    colors: jsonb("colors").$type<ThemeColors>().notNull(),
    fontFamily: text("font_family").notNull(),
    fontFamilyHeader: text("font_family_header"),
    fontSizes: jsonb("font_sizes"),
    imageMaskUrl: text("image_mask_url"),
    backgroundImageUrl: text("background_image_url"),
    isCorporate: boolean("is_corporate").notNull().default(false),

    // Assets (stored as JSON)
    assets: jsonb("assets").$type<ThemeAssets>(),

    // Font weights (stored as JSON)
    fontWeights: jsonb("font_weights").$type<FontWeights>(),

    // Visibility and ownership
    isPublic: boolean("is_public").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),

    // User relation (nullable for system themes)
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),

    // Team relation (nullable - if set, theme belongs to team)
    teamId: text("team_id"),
  },
  (table) => [index("themes_team_id_idx").on(table.teamId)]
);
