CREATE TABLE "presentations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"theme_id" text NOT NULL,
	"slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;