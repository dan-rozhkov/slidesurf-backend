import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const aiModels = pgTable(
  "ai_models",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    provider: text("provider").notNull(),
    type: text("type").notNull(), // 'text' | 'image'
    isAdvanced: boolean("is_advanced").notNull().default(false),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("ai_models_type_enabled_idx").on(table.type, table.isEnabled)]
);
