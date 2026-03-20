// Subscription limits configuration
export type SubscriptionLimits = {
  planType: string;
  maxSlidesPerGeneration: number;
  maxGenerationsPerDay: number;
  maxGenerationsPerMonth: number;
  canUseAdvancedModels: boolean;
  canUseAdvancedImageModels: boolean;
  canUseImageGeneration: boolean;
  canUseChartGeneration: boolean;
  canUseCustomThemes: boolean;
  maxAttachmentsPerGeneration: number;
  maxAttachmentSizeMB: number;
};

export const SUBSCRIPTION_LIMITS: Record<string, SubscriptionLimits> = {
  free: {
    planType: "free",
    maxSlidesPerGeneration: 8,
    maxGenerationsPerDay: 3,
    maxGenerationsPerMonth: 3,
    canUseAdvancedModels: false,
    canUseAdvancedImageModels: false,
    canUseImageGeneration: true,
    canUseChartGeneration: true,
    canUseCustomThemes: false,
    maxAttachmentsPerGeneration: 1,
    maxAttachmentSizeMB: 5,
  },
  plus: {
    planType: "plus",
    maxSlidesPerGeneration: 15,
    maxGenerationsPerDay: 20,
    maxGenerationsPerMonth: 100,
    canUseAdvancedModels: true,
    canUseAdvancedImageModels: false,
    canUseImageGeneration: true,
    canUseChartGeneration: true,
    canUseCustomThemes: false,
    maxAttachmentsPerGeneration: 3,
    maxAttachmentSizeMB: 10,
  },
  pro: {
    planType: "pro",
    maxSlidesPerGeneration: 60,
    maxGenerationsPerDay: 50,
    maxGenerationsPerMonth: 500,
    canUseAdvancedModels: true,
    canUseAdvancedImageModels: true,
    canUseImageGeneration: true,
    canUseChartGeneration: true,
    canUseCustomThemes: true,
    maxAttachmentsPerGeneration: 10,
    maxAttachmentSizeMB: 50,
  },
};

export function getSubscriptionLimits(planType: string): SubscriptionLimits {
  return SUBSCRIPTION_LIMITS[planType] || SUBSCRIPTION_LIMITS.free;
}
