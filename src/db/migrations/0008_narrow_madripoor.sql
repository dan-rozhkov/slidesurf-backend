CREATE TABLE "user_action_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action_type" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"metadata" jsonb,
	"status" text NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;