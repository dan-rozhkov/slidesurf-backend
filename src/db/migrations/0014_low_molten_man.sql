CREATE TABLE "team_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"email" text NOT NULL,
	"invited_by" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_presentations" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"presentation_id" text NOT NULL,
	"shared_by" text NOT NULL,
	"shared_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presentations" ADD CONSTRAINT "team_presentations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presentations" ADD CONSTRAINT "team_presentations_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_presentations" ADD CONSTRAINT "team_presentations_shared_by_user_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_invitations_email_team_idx" ON "team_invitations" USING btree ("email","team_id");--> statement-breakpoint
CREATE INDEX "team_invitations_token_idx" ON "team_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_invitations_expires_at_idx" ON "team_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_unique" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_members_user_team_idx" ON "team_members" USING btree ("user_id","team_id");--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_presentations_team_presentation_unique" ON "team_presentations" USING btree ("team_id","presentation_id");--> statement-breakpoint
CREATE INDEX "team_presentations_presentation_id_idx" ON "team_presentations" USING btree ("presentation_id");--> statement-breakpoint
CREATE INDEX "teams_owner_id_idx" ON "teams" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "themes_team_id_idx" ON "themes" USING btree ("team_id");