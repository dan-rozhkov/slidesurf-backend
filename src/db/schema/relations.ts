import { relations } from "drizzle-orm";
import { user, account, session, apikey } from "./auth-schema";
import { themes as themesTable } from "./themes-schema";
import { presentations as presentationsTable } from "./presentations-schema";
import { presentationPlans as presentationPlansTable } from "./presentation-plans-schema";
import { subscriptions as subscriptionsTable } from "./subscriptions-schema";
import { userActionLogs } from "./logs-schema";
import {
  teams,
  teamMembers,
  teamInvitations,
  teamPresentations,
} from "./teams-schema";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  themes: many(themesTable),
  presentations: many(presentationsTable),
  presentationPlans: many(presentationPlansTable),
  apikeys: many(apikey),
  subscriptions: many(subscriptionsTable),
  actionLogs: many(userActionLogs),
  // Team relations
  ownedTeams: many(teams),
  teamMemberships: many(teamMembers),
  sentInvitations: many(teamInvitations),
  sharedPresentations: many(teamPresentations),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const themesRelations = relations(themesTable, ({ one }) => ({
  user: one(user, {
    fields: [themesTable.userId],
    references: [user.id],
  }),
  team: one(teams, {
    fields: [themesTable.teamId],
    references: [teams.id],
  }),
}));

export const presentationsRelations = relations(
  presentationsTable,
  ({ one, many }) => ({
    user: one(user, {
      fields: [presentationsTable.userId],
      references: [user.id],
    }),
    theme: one(themesTable, {
      fields: [presentationsTable.themeId],
      references: [themesTable.id],
    }),
    plan: one(presentationPlansTable, {
      fields: [presentationsTable.planId],
      references: [presentationPlansTable.id],
    }),
    teamShares: many(teamPresentations),
  })
);

export const presentationPlansRelations = relations(
  presentationPlansTable,
  ({ one, many }) => ({
    user: one(user, {
      fields: [presentationPlansTable.userId],
      references: [user.id],
    }),
    presentations: many(presentationsTable),
  })
);

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id],
  }),
}));

export const subscriptionsRelations = relations(
  subscriptionsTable,
  ({ one }) => ({
    user: one(user, {
      fields: [subscriptionsTable.userId],
      references: [user.id],
    }),
  })
);

export const userActionLogsRelations = relations(userActionLogs, ({ one }) => ({
  user: one(user, {
    fields: [userActionLogs.userId],
    references: [user.id],
  }),
}));

// Team relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(user, {
    fields: [teams.ownerId],
    references: [user.id],
  }),
  members: many(teamMembers),
  invitations: many(teamInvitations),
  sharedPresentations: many(teamPresentations),
  themes: many(themesTable),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(user, {
    fields: [teamMembers.userId],
    references: [user.id],
  }),
}));

export const teamInvitationsRelations = relations(
  teamInvitations,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamInvitations.teamId],
      references: [teams.id],
    }),
    inviter: one(user, {
      fields: [teamInvitations.invitedBy],
      references: [user.id],
    }),
  })
);

export const teamPresentationsRelations = relations(
  teamPresentations,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamPresentations.teamId],
      references: [teams.id],
    }),
    presentation: one(presentationsTable, {
      fields: [teamPresentations.presentationId],
      references: [presentationsTable.id],
    }),
    sharer: one(user, {
      fields: [teamPresentations.sharedBy],
      references: [user.id],
    }),
  })
);
