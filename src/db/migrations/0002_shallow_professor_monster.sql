ALTER TABLE "presentations" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "presentations" ADD COLUMN "is_shared" boolean DEFAULT false NOT NULL;