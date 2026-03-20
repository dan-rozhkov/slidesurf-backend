CREATE TABLE "themes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"preview_url" text NOT NULL,
	"colors" jsonb NOT NULL,
	"font_family" text NOT NULL,
	"font_family_header" text,
	"font_sizes" jsonb,
	"image_mask_url" text,
	"background_image_url" text,
	"is_corporate" boolean DEFAULT false NOT NULL,
	"assets" jsonb,
	"chart_colors" jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;