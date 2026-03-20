import { db } from "@/db";
import { aiModels } from "@/db/schema/ai-models-schema";
import { eq, and, asc } from "drizzle-orm";

export type AIModel = {
  id: string;
  name: string;
  description: string;
  provider: string;
  advanced?: boolean;
};

// ─── In-memory cache (TTL 60s) ──────────────────────────────────────────────

type CacheEntry<T> = { data: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60_000; // 60 seconds

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  cache.delete(key);
  return undefined;
}

function setCache<T>(key: string, data: T): T {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  return data;
}

// ─── DB row → AIModel mapper ─────────────────────────────────────────────────

function toAIModel(row: typeof aiModels.$inferSelect): AIModel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    provider: row.provider,
    advanced: row.isAdvanced,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all enabled models of a given type, ordered by sort_order.
 */
export async function getAvailableModels(
  type: "text" | "image"
): Promise<AIModel[]> {
  const cacheKey = `models:${type}`;
  const cached = getCached<AIModel[]>(cacheKey);
  if (cached) return cached;

  const rows = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.type, type), eq(aiModels.isEnabled, true)))
    .orderBy(asc(aiModels.sortOrder));

  return setCache(cacheKey, rows.map(toAIModel));
}

/**
 * Get model by ID (enabled or not).
 */
export async function getModelById(
  id: string
): Promise<AIModel | undefined> {
  const cacheKey = `model:${id}`;
  const cached = getCached<AIModel | null>(cacheKey);
  if (cached !== undefined) return cached ?? undefined;

  const rows = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.id, id))
    .limit(1);

  const model = rows[0] ? toAIModel(rows[0]) : null;
  setCache(cacheKey, model);
  return model ?? undefined;
}

/**
 * Check if model is advanced.
 */
export async function isAdvancedModel(modelId: string): Promise<boolean> {
  const model = await getModelById(modelId);
  return model?.advanced === true;
}

/**
 * Get the default text model (first enabled text model by sort_order).
 */
export async function getDefaultModel(): Promise<string> {
  const models = await getAvailableModels("text");
  return models[0]?.id ?? "google/gemini-3-flash-preview";
}

/**
 * Get the default image model (first enabled image model by sort_order).
 */
export async function getDefaultImageModel(): Promise<string> {
  const models = await getAvailableModels("image");
  return models[0]?.id ?? "fal-ai/flux-1/schnell";
}

/**
 * Get available text models for subscription plan.
 */
export async function getAvailableModelsForPlan(
  canUseAdvancedModels: boolean
): Promise<AIModel[]> {
  const models = await getAvailableModels("text");
  if (canUseAdvancedModels) return models;
  return models.filter((m) => !m.advanced);
}

/**
 * Get available image models for subscription plan.
 */
export async function getAvailableImageModelsForPlan(
  canUseAdvancedModels: boolean
): Promise<AIModel[]> {
  const models = await getAvailableModels("image");
  if (canUseAdvancedModels) return models;
  return models.filter((m) => !m.advanced);
}
