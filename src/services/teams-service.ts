import { db } from "@/db";
import {
  teams,
  teamMembers,
  teamInvitations,
  teamPresentations,
} from "@/db/schema/teams-schema";
import { themes } from "@/db/schema/themes-schema";
import { presentations } from "@/db/schema/presentations-schema";
import { user } from "@/db/schema/auth-schema";
import { eq, and, isNull, lt, gt, inArray } from "drizzle-orm";
import { nanoid } from "@/utils/nanoid";
import { sendEmail } from "@/email";
import { getTeamInvitationEmailTemplate } from "@/email/templates";
import type {
  Team,
  TeamMember,
  TeamInvitation,
  TeamWithMembers,
  TeamWithRole,
} from "@/types";
import {
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
} from "@/shared/validators/teams";

const INVITATION_EXPIRY_DAYS = 7;
const MAX_INVITATIONS_PER_HOUR = 10;
const INVITATION_TOKEN_LENGTH = 32;

function getBaseUrl(): string {
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!baseUrl) {
    throw new Error("BETTER_AUTH_URL environment variable is not set");
  }
  return baseUrl;
}

async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return !!member;
}

async function isTeamOwner(teamId: string, userId: string): Promise<boolean> {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "owner")
      )
    )
    .limit(1);
  return !!member;
}

async function getUserTeamRole(
  teamId: string,
  userId: string
): Promise<"owner" | "member" | null> {
  const [member] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return member?.role ?? null;
}

export async function createTeam(
  userId: string,
  name: string,
  description?: string
) {
  const validationResult = createTeamSchema.safeParse({ name, description });
  if (!validationResult.success) {
    throw new Error(validationResult.error.errors[0].message);
  }

  const teamId = nanoid();
  const memberId = nanoid();

  const newTeam = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({
        id: teamId,
        name: validationResult.data.name,
        description: validationResult.data.description || null,
        ownerId: userId,
      })
      .returning();

    await tx.insert(teamMembers).values({
      id: memberId,
      teamId: teamId,
      userId: userId,
      role: "owner",
    });

    return team;
  });

  return newTeam;
}

export async function getUserTeams(userId: string): Promise<TeamWithRole[]> {
  const userTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      ownerId: teams.ownerId,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      role: teamMembers.role,
    })
    .from(teams)
    .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .orderBy(teams.createdAt);

  return userTeams as TeamWithRole[];
}

export async function getTeamById(
  teamId: string,
  userId: string
): Promise<TeamWithMembers | null> {
  const isMember = await isTeamMember(teamId, userId);
  if (!isMember) return null;

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return null;

  const members = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.userId, user.id))
    .where(eq(teamMembers.teamId, teamId));

  return {
    ...team,
    members: members as TeamMember[],
    memberCount: members.length,
  };
}

export async function updateTeam(
  teamId: string,
  userId: string,
  data: { name?: string; description?: string }
) {
  const validationResult = updateTeamSchema.safeParse(data);
  if (!validationResult.success) {
    throw new Error(validationResult.error.errors[0].message);
  }

  const isOwner = await isTeamOwner(teamId, userId);
  if (!isOwner) {
    throw new Error("Only the team owner can update team settings");
  }

  const [updatedTeam] = await db
    .update(teams)
    .set({ ...validationResult.data, updatedAt: new Date() })
    .where(eq(teams.id, teamId))
    .returning();

  return updatedTeam;
}

export async function inviteMember(
  teamId: string,
  userId: string,
  userEmail: string,
  userName: string,
  email: string
) {
  const validationResult = inviteMemberSchema.safeParse({ email });
  if (!validationResult.success) {
    throw new Error(validationResult.error.errors[0].message);
  }

  const normalizedEmail = validationResult.data.email.toLowerCase();

  const isMember = await isTeamMember(teamId, userId);
  if (!isMember) {
    throw new Error("You must be a team member to invite others");
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) throw new Error("Team not found");

  if (userEmail?.toLowerCase() === normalizedEmail) {
    throw new Error("You cannot invite yourself");
  }

  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    const existingMemberCheck = await isTeamMember(teamId, existingUser.id);
    if (existingMemberCheck) {
      throw new Error("This user is already a team member");
    }
  }

  const now = new Date();
  const [existingInvitation] = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, normalizedEmail),
        isNull(teamInvitations.acceptedAt),
        gt(teamInvitations.expiresAt, now)
      )
    )
    .limit(1);

  if (existingInvitation) {
    throw new Error("An invitation has already been sent to this email");
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentInvitations = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        gt(teamInvitations.createdAt, oneHourAgo)
      )
    );

  if (recentInvitations.length >= MAX_INVITATIONS_PER_HOUR) {
    throw new Error(
      `Rate limit exceeded. Maximum ${MAX_INVITATIONS_PER_HOUR} invitations per hour.`
    );
  }

  await db
    .delete(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, normalizedEmail)
      )
    );

  const token = nanoid(INVITATION_TOKEN_LENGTH);
  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  const [invitation] = await db
    .insert(teamInvitations)
    .values({
      id: nanoid(),
      teamId,
      email: normalizedEmail,
      invitedBy: userId,
      token,
      expiresAt,
    })
    .returning();

  const invitationUrl = `${getBaseUrl()}/teams/invitations/${token}`;
  const emailTemplate = getTeamInvitationEmailTemplate(
    team.name,
    userName || userEmail || "A team member",
    invitationUrl,
    INVITATION_EXPIRY_DAYS
  );

  try {
    await sendEmail({ to: normalizedEmail, ...emailTemplate });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }

  return invitation;
}

export async function acceptInvitation(token: string, userId: string, userEmailAddress: string) {
  const [invitation] = await db
    .select({
      id: teamInvitations.id,
      teamId: teamInvitations.teamId,
      email: teamInvitations.email,
      expiresAt: teamInvitations.expiresAt,
      acceptedAt: teamInvitations.acceptedAt,
      team: { id: teams.id, name: teams.name },
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .where(eq(teamInvitations.token, token))
    .limit(1);

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.acceptedAt) throw new Error("This invitation has already been accepted");
  if (invitation.expiresAt < new Date()) throw new Error("This invitation has expired");
  if (userEmailAddress?.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error("This invitation was sent to a different email address.");
  }

  const existingMemberCheck = await isTeamMember(invitation.teamId, userId);
  if (existingMemberCheck) throw new Error("You are already a member of this team");

  await db.transaction(async (tx) => {
    await tx.insert(teamMembers).values({
      id: nanoid(),
      teamId: invitation.teamId,
      userId,
      role: "member",
    });
    await tx
      .update(teamInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(teamInvitations.id, invitation.id));
  });

  return invitation.team;
}

export async function getInvitationByToken(token: string) {
  const [invitation] = await db
    .select({
      id: teamInvitations.id,
      email: teamInvitations.email,
      expiresAt: teamInvitations.expiresAt,
      acceptedAt: teamInvitations.acceptedAt,
      createdAt: teamInvitations.createdAt,
      team: { id: teams.id, name: teams.name, description: teams.description },
      inviter: { id: user.id, name: user.name, email: user.email },
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .innerJoin(user, eq(teamInvitations.invitedBy, user.id))
    .where(eq(teamInvitations.token, token))
    .limit(1);

  if (!invitation) return null;

  return {
    ...invitation,
    isExpired: invitation.expiresAt < new Date(),
    isAccepted: !!invitation.acceptedAt,
  };
}

export async function removeMember(teamId: string, userId: string, memberUserId: string) {
  const isOwner = await isTeamOwner(teamId, userId);
  if (!isOwner) throw new Error("Only the team owner can remove members");
  if (memberUserId === userId) throw new Error("You cannot remove yourself.");

  const memberRole = await getUserTeamRole(teamId, memberUserId);
  if (memberRole === "owner") throw new Error("Cannot remove the team owner.");
  if (!memberRole) throw new Error("User is not a member of this team");

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)));

  await db
    .delete(teamPresentations)
    .where(and(eq(teamPresentations.teamId, teamId), eq(teamPresentations.sharedBy, memberUserId)));

  return { success: true };
}

export async function leaveTeam(teamId: string, userId: string) {
  const role = await getUserTeamRole(teamId, userId);
  if (!role) throw new Error("You are not a member of this team");
  if (role === "owner") throw new Error("Team owner cannot leave.");

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  await db
    .delete(teamPresentations)
    .where(and(eq(teamPresentations.teamId, teamId), eq(teamPresentations.sharedBy, userId)));

  return { success: true };
}

export async function transferOwnership(teamId: string, userId: string, newOwnerId: string) {
  const isOwner = await isTeamOwner(teamId, userId);
  if (!isOwner) throw new Error("Only the team owner can transfer ownership");

  const newOwnerRole = await getUserTeamRole(teamId, newOwnerId);
  if (!newOwnerRole) throw new Error("The new owner must be a team member");

  await db.transaction(async (tx) => {
    await tx
      .update(teamMembers)
      .set({ role: "member" })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    await tx
      .update(teamMembers)
      .set({ role: "owner" })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newOwnerId)));
    await tx
      .update(teams)
      .set({ ownerId: newOwnerId, updatedAt: new Date() })
      .where(eq(teams.id, teamId));
  });

  return { success: true };
}

export async function deleteTeam(teamId: string, userId: string) {
  const isOwner = await isTeamOwner(teamId, userId);
  if (!isOwner) throw new Error("Only the team owner can delete the team");

  await db.transaction(async (tx) => {
    await tx
      .update(themes)
      .set({ teamId: null, userId })
      .where(eq(themes.teamId, teamId));
    await tx.delete(teams).where(eq(teams.id, teamId));
  });

  return { success: true };
}

export async function getTeamMembers(teamId: string, userId: string): Promise<TeamMember[]> {
  const isMember = await isTeamMember(teamId, userId);
  if (!isMember) throw new Error("You must be a team member to view members");

  const members = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
    })
    .from(teamMembers)
    .innerJoin(user, eq(teamMembers.userId, user.id))
    .where(eq(teamMembers.teamId, teamId));

  return members as TeamMember[];
}

export async function getTeamInvitations(teamId: string, userId: string): Promise<TeamInvitation[]> {
  const isMember = await isTeamMember(teamId, userId);
  if (!isMember) throw new Error("You must be a team member to view invitations");

  const now = new Date();
  const invitations = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        isNull(teamInvitations.acceptedAt),
        gt(teamInvitations.expiresAt, now)
      )
    );

  return invitations as TeamInvitation[];
}

export async function cancelInvitation(invitationId: string, userId: string) {
  const [invitation] = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.id, invitationId))
    .limit(1);

  if (!invitation) throw new Error("Invitation not found");

  const isOwner = await isTeamOwner(invitation.teamId, userId);
  if (!isOwner && invitation.invitedBy !== userId) {
    throw new Error("Only the team owner or inviter can cancel invitations");
  }

  await db.delete(teamInvitations).where(eq(teamInvitations.id, invitationId));
  return { success: true };
}

export async function sharePresentationWithTeam(
  presentationId: string,
  teamId: string,
  userId: string
) {
  const [presentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!presentation) throw new Error("Presentation not found");
  if (presentation.userId !== userId) throw new Error("You can only share your own presentations");

  const isMember = await isTeamMember(teamId, userId);
  if (!isMember) throw new Error("You must be a team member to share presentations");

  const [existingShare] = await db
    .select()
    .from(teamPresentations)
    .where(
      and(
        eq(teamPresentations.teamId, teamId),
        eq(teamPresentations.presentationId, presentationId)
      )
    )
    .limit(1);

  if (existingShare) return { success: true };

  try {
    await db.insert(teamPresentations).values({
      id: nanoid(),
      teamId,
      presentationId,
      sharedBy: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return { success: true };
    }
    throw error;
  }

  return { success: true };
}

export async function unsharePresentationFromTeam(
  presentationId: string,
  teamId: string,
  userId: string
) {
  const [presentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!presentation) throw new Error("Presentation not found");
  if (presentation.userId !== userId) throw new Error("You can only unshare your own presentations");

  await db
    .delete(teamPresentations)
    .where(
      and(
        eq(teamPresentations.teamId, teamId),
        eq(teamPresentations.presentationId, presentationId)
      )
    );

  return { success: true };
}

export async function getTeamSharedPresentations(teamId: string, userId: string) {
  const isMember = await isTeamMember(teamId, userId);
  if (!isMember) throw new Error("You must be a team member to view shared presentations");

  return db
    .select({
      id: presentations.id,
      title: presentations.title,
      themeId: presentations.themeId,
      previewUrl: presentations.previewUrl,
      updatedAt: presentations.updatedAt,
      createdAt: presentations.createdAt,
      isDeleted: presentations.isDeleted,
      isShared: presentations.isShared,
      userId: presentations.userId,
      sharedBy: teamPresentations.sharedBy,
      sharedAt: teamPresentations.sharedAt,
      owner: { id: user.id, name: user.name, email: user.email },
    })
    .from(teamPresentations)
    .innerJoin(presentations, eq(teamPresentations.presentationId, presentations.id))
    .innerJoin(user, eq(presentations.userId, user.id))
    .where(
      and(eq(teamPresentations.teamId, teamId), eq(presentations.isDeleted, false))
    );
}

export async function getPresentationTeams(presentationId: string, userId: string) {
  const [presentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!presentation || presentation.userId !== userId) return [];

  return db
    .select({
      id: teams.id,
      name: teams.name,
      sharedAt: teamPresentations.sharedAt,
    })
    .from(teamPresentations)
    .innerJoin(teams, eq(teamPresentations.teamId, teams.id))
    .where(eq(teamPresentations.presentationId, presentationId));
}

export async function cleanupExpiredInvitations() {
  const now = new Date();
  await db
    .delete(teamInvitations)
    .where(
      and(lt(teamInvitations.expiresAt, now), isNull(teamInvitations.acceptedAt))
    );
  return { success: true };
}
