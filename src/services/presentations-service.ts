import { db } from "@/db";
import { presentations } from "@/db/schema/presentations-schema";
import { teamMembers, teamPresentations } from "@/db/schema/teams-schema";
import { eq, inArray, or, desc, and } from "drizzle-orm";
import { nanoid } from "@/utils/nanoid";
import { SLIDE_TEMPLATES } from "@/templates/new-slide-templates";
import { Presentation, Slide, SlidesTemplates } from "@/types";

async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return memberships.map((m) => m.teamId);
}

async function hasTeamAccessToPresentation(
  presentationId: string,
  userId: string
): Promise<boolean> {
  const userTeamIds = await getUserTeamIds(userId);
  if (userTeamIds.length === 0) return false;

  const [sharedAccess] = await db
    .select()
    .from(teamPresentations)
    .where(
      and(
        eq(teamPresentations.presentationId, presentationId),
        inArray(teamPresentations.teamId, userTeamIds)
      )
    )
    .limit(1);

  return !!sharedAccess;
}

export async function createPresentation(
  presentation: Omit<Presentation, "id">,
  userId: string
) {
  const [newPresentation] = await db
    .insert(presentations)
    .values({
      id: nanoid(),
      ...presentation,
      userId,
      planId: presentation.planId,
    })
    .returning();

  return newPresentation;
}

export async function getPresentations(userId: string) {
  return db
    .select()
    .from(presentations)
    .where(
      and(eq(presentations.userId, userId), eq(presentations.isDeleted, false))
    )
    .orderBy(desc(presentations.updatedAt))
    .limit(10);
}

export async function getPresentationsWithTeamShared(userId: string) {
  const userTeamIds = await getUserTeamIds(userId);

  const ownPresentations = await db
    .select()
    .from(presentations)
    .where(
      and(eq(presentations.userId, userId), eq(presentations.isDeleted, false))
    )
    .orderBy(desc(presentations.updatedAt));

  if (userTeamIds.length === 0) {
    return ownPresentations.slice(0, 10);
  }

  const sharedPresentationRecords = await db
    .select({ presentationId: teamPresentations.presentationId })
    .from(teamPresentations)
    .where(inArray(teamPresentations.teamId, userTeamIds));

  const sharedPresentationIds = sharedPresentationRecords.map(
    (r) => r.presentationId
  );

  const ownIds = new Set(ownPresentations.map((p) => p.id));
  const uniqueSharedIds = sharedPresentationIds.filter((id) => !ownIds.has(id));

  if (uniqueSharedIds.length === 0) {
    return ownPresentations.slice(0, 10);
  }

  const sharedPresentations = await db
    .select()
    .from(presentations)
    .where(
      and(
        inArray(presentations.id, uniqueSharedIds),
        eq(presentations.isDeleted, false)
      )
    )
    .orderBy(desc(presentations.updatedAt));

  const allPresentations = [...ownPresentations, ...sharedPresentations];
  allPresentations.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  });

  return allPresentations.slice(0, 20);
}

export async function getDeletedPresentations(userId: string) {
  return db
    .select()
    .from(presentations)
    .where(
      and(eq(presentations.userId, userId), eq(presentations.isDeleted, true))
    )
    .orderBy(desc(presentations.updatedAt))
    .limit(10);
}

export async function getPresentationById(
  presentationId: string,
  userId?: string
) {
  const [presentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!presentation) return null;

  if (presentation.isShared) return presentation;

  if (!userId) return null;

  if (presentation.userId === userId) return presentation;

  const hasTeamAccess = await hasTeamAccessToPresentation(
    presentationId,
    userId
  );
  return hasTeamAccess ? presentation : null;
}

export async function updatePresentation(
  presentationId: string,
  presentation: Partial<Presentation>,
  userId: string
) {
  const [existingPresentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!existingPresentation) return null;

  const isOwner = existingPresentation.userId === userId;
  const hasTeamAccess = await hasTeamAccessToPresentation(
    presentationId,
    userId
  );

  if (!isOwner && !hasTeamAccess) return null;

  const [updatedPresentation] = await db
    .update(presentations)
    .set({ ...presentation, updatedAt: new Date() })
    .where(eq(presentations.id, presentationId))
    .returning();

  return updatedPresentation;
}

export async function toTrash(presentationId: string, userId: string) {
  const [existingPresentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!existingPresentation || existingPresentation.userId !== userId) return;

  await db
    .update(presentations)
    .set({ isDeleted: true })
    .where(eq(presentations.id, presentationId));
}

export async function restorePresentation(
  presentationId: string,
  userId: string
) {
  const [existingPresentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!existingPresentation || existingPresentation.userId !== userId) return;

  await db
    .update(presentations)
    .set({ isDeleted: false })
    .where(eq(presentations.id, presentationId));
}

export async function deletePresentation(
  presentationId: string,
  userId: string
) {
  const [existingPresentation] = await db
    .select()
    .from(presentations)
    .where(eq(presentations.id, presentationId))
    .limit(1);

  if (!existingPresentation || existingPresentation.userId !== userId) return;

  await db.delete(presentations).where(eq(presentations.id, presentationId));
}

export async function getSharedWithMePresentations(userId: string) {
  const userTeamIds = await getUserTeamIds(userId);
  if (userTeamIds.length === 0) return [];

  const sharedPresentationRecords = await db
    .select({ presentationId: teamPresentations.presentationId })
    .from(teamPresentations)
    .where(inArray(teamPresentations.teamId, userTeamIds));

  const sharedPresentationIds = sharedPresentationRecords.map(
    (r) => r.presentationId
  );

  if (sharedPresentationIds.length === 0) return [];

  const sharedPresentations = await db
    .select()
    .from(presentations)
    .where(
      and(
        inArray(presentations.id, sharedPresentationIds),
        eq(presentations.isDeleted, false)
      )
    )
    .orderBy(desc(presentations.updatedAt));

  return sharedPresentations.filter((p) => p.userId !== userId);
}

export async function createEmptyPresentation(userId: string) {
  const slideTemplate = SLIDE_TEMPLATES.find(
    (template) => template.name === SlidesTemplates.FRONT_SLIDE
  );

  const [newPresentation] = await db
    .insert(presentations)
    .values({
      id: nanoid(),
      title: "Без названия",
      slides: slideTemplate
        ? ([
            {
              id: nanoid(),
              content: slideTemplate.content,
              layout: slideTemplate.layout,
              verticalAlign: slideTemplate.verticalAlign,
            },
          ] as Slide[])
        : [],
      themeId: "tech-community",
      userId,
    })
    .returning();

  return newPresentation;
}
