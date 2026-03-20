import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const promoCodes = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(), // "percentage" or "fixed"
  discountValue: integer("discount_value").notNull(), // percentage (0-100) or fixed amount in rubles
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  planTypes: text("plan_types"), // comma-separated list of plan types (null = all plans), e.g. "plus,pro"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const promoCodeUsages = pgTable("promo_code_usages", {
  id: text("id").primaryKey(),
  promoCodeId: text("promo_code_id")
    .notNull()
    .references(() => promoCodes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  planType: text("plan_type").notNull(),
  originalPrice: integer("original_price").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  finalPrice: integer("final_price").notNull(),
  usedAt: timestamp("used_at")
    .$defaultFn(() => new Date())
    .notNull(),
});
