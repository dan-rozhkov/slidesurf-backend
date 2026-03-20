import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { presentations } from "./presentations-schema";

// Teams table (workspaces)
export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("teams_owner_id_idx").on(table.ownerId)]
);

// Team members junction table
export const teamMembers = pgTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "member">().notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_members_team_user_unique").on(table.teamId, table.userId),
    index("team_members_user_team_idx").on(table.userId, table.teamId),
    index("team_members_team_id_idx").on(table.teamId),
  ]
);

// Team invitations table
export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("team_invitations_email_team_idx").on(table.email, table.teamId),
    index("team_invitations_token_idx").on(table.token),
    index("team_invitations_expires_at_idx").on(table.expiresAt),
  ]
);

// Team presentations junction table (for sharing)
export const teamPresentations = pgTable(
  "team_presentations",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    presentationId: text("presentation_id")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    sharedBy: text("shared_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sharedAt: timestamp("shared_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_presentations_team_presentation_unique").on(
      table.teamId,
      table.presentationId
    ),
    index("team_presentations_presentation_id_idx").on(table.presentationId),
  ]
);
