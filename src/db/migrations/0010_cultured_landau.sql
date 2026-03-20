CREATE TABLE "promo_code_usages" (
	"id" text PRIMARY KEY NOT NULL,
	"promo_code_id" text NOT NULL,
	"user_id" text NOT NULL,
	"plan_type" text NOT NULL,
	"original_price" integer NOT NULL,
	"discount_amount" integer NOT NULL,
	"final_price" integer NOT NULL,
	"used_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"plan_types" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;