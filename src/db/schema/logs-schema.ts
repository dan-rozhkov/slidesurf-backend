import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const userActionLogs = pgTable("user_action_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(), // 'generate_plan' | 'generate_slides' | 'generate_image'
  timestamp: timestamp("timestamp")
    .$defaultFn(() => new Date())
    .notNull(),
  metadata: jsonb("metadata"), // Store slidesCount, model, attachmentsCount, etc.
  status: text("status").notNull(), // 'success' | 'error'
  errorMessage: text("error_message"),
});
