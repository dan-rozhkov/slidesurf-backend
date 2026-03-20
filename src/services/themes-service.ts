import { db } from "@/db";
import { themes } from "@/db/schema/themes-schema";
import { teamMembers } from "@/db/schema/teams-schema";
import { eq, and, or, isNull, inArray, sql } from "drizzle-orm";
import type { Theme } from "@/types";
import { nanoid } from "@/utils/nanoid";

const createThemeSelect = () => ({
  id: themes.id,
  name: themes.name,
  previewUrl: themes.previewUrl,
  colors: themes.colors,
  fontFamily: themes.fontFamily,
  fontFamilyHeader: themes.fontFamilyHeader,
  fontSizes: themes.fontSizes,
  fontWeights: themes.fontWeights,
  imageMaskUrl: themes.imageMaskUrl,
  backgroundImageUrl: themes.backgroundImageUrl,
  isCorporate: themes.isCorporate,
  assets: themes.assets,
  isPublic: themes.isPublic,
  teamId: themes.teamId,
});

async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return memberships.map((m) => m.teamId);
}

export class ThemesService {
  static async getAvailableThemes(userId?: string): Promise<Theme[]> {
    if (!userId) {
      const dbThemes = await db
        .select(createThemeSelect())
        .from(themes)
        .where(and(isNull(themes.userId), eq(themes.isPublic, true)))
        .orderBy(sql`RANDOM()`);
      return dbThemes as Theme[];
    }

    const userTeamIds = await getUserTeamIds(userId);

    let whereClause;
    if (userTeamIds.length > 0) {
      whereClause = or(
        and(isNull(themes.userId), eq(themes.isPublic, true)),
        and(eq(themes.userId, userId), isNull(themes.teamId)),
        inArray(themes.teamId, userTeamIds)
      );
    } else {
      whereClause = or(
        and(isNull(themes.userId), eq(themes.isPublic, true)),
        and(eq(themes.userId, userId), isNull(themes.teamId))
      );
    }

    const dbThemes = await db
      .select(createThemeSelect())
      .from(themes)
      .where(whereClause)
      .orderBy(sql`RANDOM()`);

    return dbThemes as Theme[];
  }

  static async getThemeById(
    themeId: string,
    userId?: string
  ): Promise<Theme | null> {
    const [theme] = await db
      .select(createThemeSelect())
      .from(themes)
      .where(eq(themes.id, themeId))
      .limit(1);

    if (!theme) return null;

    if (theme.isPublic && !theme.teamId) return theme as Theme;
    if (!userId) return theme.isPublic ? (theme as Theme) : null;

    const [ownTheme] = await db
      .select()
      .from(themes)
      .where(
        and(
          eq(themes.id, themeId),
          eq(themes.userId, userId),
          isNull(themes.teamId)
        )
      )
      .limit(1);

    if (ownTheme) return theme as Theme;

    if (theme.teamId) {
      const userTeamIds = await getUserTeamIds(userId);
      if (userTeamIds.includes(theme.teamId)) return theme as Theme;
    }

    return null;
  }

  static async createTheme(
    themeData: Omit<Theme, "id">,
    userId: string,
    teamId?: string
  ): Promise<Theme> {
    if (teamId) {
      const userTeamIds = await getUserTeamIds(userId);
      if (!userTeamIds.includes(teamId)) {
        throw new Error("You must be a team member to create team themes");
      }
    }

    const themeId = nanoid();

    const [newTheme] = await db
      .insert(themes)
      .values({
        id: themeId,
        ...themeData,
        userId: teamId ? null : userId,
        teamId: teamId || null,
        isPublic: false,
      })
      .returning(createThemeSelect());

    return newTheme as Theme;
  }

  static async updateTheme(
    themeId: string,
    themeData: Partial<Theme>,
    userId: string
  ): Promise<Theme | null> {
    const [existingTheme] = await db
      .select()
      .from(themes)
      .where(eq(themes.id, themeId))
      .limit(1);

    if (!existingTheme) return null;

    if (existingTheme.userId === userId && !existingTheme.teamId) {
      const [updatedTheme] = await db
        .update(themes)
        .set({ ...themeData, updatedAt: new Date() })
        .where(eq(themes.id, themeId))
        .returning(createThemeSelect());
      return updatedTheme ? (updatedTheme as Theme) : null;
    }

    if (existingTheme.teamId) {
      const userTeamIds = await getUserTeamIds(userId);
      if (userTeamIds.includes(existingTheme.teamId)) {
        const [updatedTheme] = await db
          .update(themes)
          .set({ ...themeData, updatedAt: new Date() })
          .where(eq(themes.id, themeId))
          .returning(createThemeSelect());
        return updatedTheme ? (updatedTheme as Theme) : null;
      }
    }

    return null;
  }

  static async deleteTheme(themeId: string, userId: string): Promise<boolean> {
    const [existingTheme] = await db
      .select()
      .from(themes)
      .where(eq(themes.id, themeId))
      .limit(1);

    if (!existingTheme) return false;

    if (existingTheme.userId === userId && !existingTheme.teamId) {
      await db.delete(themes).where(eq(themes.id, themeId));
      return true;
    }

    if (existingTheme.teamId) {
      const userTeamIds = await getUserTeamIds(userId);
      if (userTeamIds.includes(existingTheme.teamId)) {
        await db.delete(themes).where(eq(themes.id, themeId));
        return true;
      }
    }

    return false;
  }

  static async setThemeVisibility(
    themeId: string,
    isPublic: boolean,
    userId: string
  ): Promise<Theme | null> {
    const [updatedTheme] = await db
      .update(themes)
      .set({
        isPublic,
        updatedAt: new Date(),
      })
      .where(and(eq(themes.id, themeId), eq(themes.userId, userId)))
      .returning(createThemeSelect());

    return updatedTheme ? (updatedTheme as Theme) : null;
  }

  static async getUserThemes(userId: string): Promise<Theme[]> {
    const userTeamIds = await getUserTeamIds(userId);

    let whereClause;
    if (userTeamIds.length > 0) {
      whereClause = or(
        and(eq(themes.userId, userId), isNull(themes.teamId)),
        inArray(themes.teamId, userTeamIds)
      );
    } else {
      whereClause = and(eq(themes.userId, userId), isNull(themes.teamId));
    }

    const dbThemes = await db
      .select(createThemeSelect())
      .from(themes)
      .where(whereClause)
      .orderBy(sql`RANDOM()`);

    return dbThemes as Theme[];
  }

  static async getTeamThemes(teamId: string, userId: string): Promise<Theme[]> {
    const userTeamIds = await getUserTeamIds(userId);
    if (!userTeamIds.includes(teamId)) {
      throw new Error("You must be a team member to view team themes");
    }

    const dbThemes = await db
      .select(createThemeSelect())
      .from(themes)
      .where(eq(themes.teamId, teamId))
      .orderBy(sql`RANDOM()`);

    return dbThemes as Theme[];
  }
}
