CREATE TABLE "presentation_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"language" text NOT NULL,
	"slides_count" integer NOT NULL,
	"research" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presentation_plans" ADD CONSTRAINT "presentation_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;