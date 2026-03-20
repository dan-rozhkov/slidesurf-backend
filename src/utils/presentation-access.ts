import { db } from "@/db";
import { presentations } from "@/db/schema/presentations-schema";
import { teamMembers, teamPresentations } from "@/db/schema/teams-schema";
import { and, eq, inArray } from "drizzle-orm";

export async function getAccessiblePresentation(
  presentationId: string,
  userId: string
) {
  const [presentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!presentation || presentation.isDeleted) return null;

  if (presentation.userId === userId || presentation.isShared) {
    return presentation;
  }

  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  if (memberships.length === 0) return null;

  const teamIds = memberships.map((m) => m.teamId);

  const [sharedAccess] = await db
    .select()
    .from(teamPresentations)
    .where(
      and(
        eq(teamPresentations.presentationId, presentationId),
        inArray(teamPresentations.teamId, teamIds)
      )
    )
    .limit(1);

  return sharedAccess ? presentation : null;
}
