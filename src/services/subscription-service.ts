import { db } from "@/db";
import { subscriptions } from "@/db/schema/subscriptions-schema";
import { userActionLogs } from "@/db/schema/logs-schema";
import { eq, and, gte, lte, count } from "drizzle-orm";
import {
  getSubscriptionLimits,
  type SubscriptionLimits,
} from "@/subscription-limits";
import { isAdvancedModel } from "@/models";
import { env } from "@/config/env";

export type ActiveSubscription = {
  planType: string;
  limits: SubscriptionLimits;
  isActive: boolean;
  expiresAt: Date | null;
};

export type SubscriptionCheckResult = {
  success: boolean;
  subscription?: ActiveSubscription;
  error?: string;
};

export async function checkActiveSubscription(
  userId: string
): Promise<SubscriptionCheckResult> {
  try {
    const now = new Date();

    const activeSubscription = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          lte(subscriptions.startDate, now),
          gte(subscriptions.endDate, now)
        )
      )
      .orderBy(subscriptions.endDate)
      .limit(1);

    if (activeSubscription.length === 0) {
      const freeLimits = getSubscriptionLimits("free");
      return {
        success: true,
        subscription: {
          planType: "free",
          limits: freeLimits,
          isActive: false,
          expiresAt: null,
        },
      };
    }

    const subscription = activeSubscription[0];
    const limits = getSubscriptionLimits(subscription.planType);

    return {
      success: true,
      subscription: {
        planType: subscription.planType,
        limits,
        isActive: true,
        expiresAt: subscription.endDate,
      },
    };
  } catch (error) {
    console.error("Error checking subscription:", error);
    return {
      success: false,
      error: "Failed to check subscription status",
    };
  }
}

export async function getGenerationsCount(
  userId: string,
  period: "day" | "month"
): Promise<number> {
  try {
    const now = new Date();
    const startOfPeriod = new Date(now);

    if (period === "day") {
      startOfPeriod.setHours(now.getHours() - 24);
    } else {
      startOfPeriod.setDate(now.getDate() - 30);
    }

    const result = await db
      .select({ count: count() })
      .from(userActionLogs)
      .where(
        and(
          eq(userActionLogs.userId, userId),
          eq(userActionLogs.actionType, "generate_slides"),
          eq(userActionLogs.status, "success"),
          gte(userActionLogs.timestamp, startOfPeriod)
        )
      );

    return result[0]?.count || 0;
  } catch (error) {
    console.error("Error getting generations count:", error);
    return 0;
  }
}

export async function canPerformAction(
  userId: string,
  action: keyof SubscriptionLimits,
  value?: number,
  modelId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!env.SUBSCRIPTION_ENABLED) {
    return { allowed: true };
  }

  const subscriptionResult = await checkActiveSubscription(userId);

  if (!subscriptionResult.success || !subscriptionResult.subscription) {
    return { allowed: false, reason: "Subscription check failed" };
  }

  const { limits } = subscriptionResult.subscription;

  switch (action) {
    case "maxSlidesPerGeneration":
      if (value && value > limits.maxSlidesPerGeneration) {
        return {
          allowed: false,
          reason: `Maximum ${limits.maxSlidesPerGeneration} slides allowed per generation`,
        };
      }
      break;

    case "maxAttachmentsPerGeneration":
      if (value && value > limits.maxAttachmentsPerGeneration) {
        return {
          allowed: false,
          reason: `Maximum ${limits.maxAttachmentsPerGeneration} attachments allowed per generation`,
        };
      }
      break;

    case "canUseAdvancedModels":
      if (!limits.canUseAdvancedModels) {
        return {
          allowed: false,
          reason: "Advanced models not available in your plan",
        };
      }
      if (modelId && (await isAdvancedModel(modelId)) && !limits.canUseAdvancedModels) {
        return {
          allowed: false,
          reason: "This advanced model is not available in your plan",
        };
      }
      break;

    case "canUseImageGeneration":
      if (!limits.canUseImageGeneration) {
        return {
          allowed: false,
          reason: "Image generation not available in your plan",
        };
      }
      break;

    case "canUseChartGeneration":
      if (!limits.canUseChartGeneration) {
        return {
          allowed: false,
          reason: "Chart generation not available in your plan",
        };
      }
      break;

    case "canUseCustomThemes":
      if (!limits.canUseCustomThemes) {
        return {
          allowed: false,
          reason: "Custom themes not available in your plan",
        };
      }
      break;

    case "maxGenerationsPerDay": {
      const dailyCount = await getGenerationsCount(userId, "day");
      if (dailyCount >= limits.maxGenerationsPerDay) {
        return {
          allowed: false,
          reason: `Daily generation limit reached (${limits.maxGenerationsPerDay} per day)`,
        };
      }
      break;
    }

    case "maxGenerationsPerMonth": {
      const monthlyCount = await getGenerationsCount(userId, "month");
      if (monthlyCount >= limits.maxGenerationsPerMonth) {
        return {
          allowed: false,
          reason: `Monthly generation limit reached (${limits.maxGenerationsPerMonth} per month)`,
        };
      }
      break;
    }
  }

  return { allowed: true };
}

export async function getSubscriptionLimitsForUser(
  userId: string
): Promise<SubscriptionLimits> {
  if (!env.SUBSCRIPTION_ENABLED) {
    return getSubscriptionLimits("pro");
  }

  const result = await checkActiveSubscription(userId);
  return result.subscription?.limits || getSubscriptionLimits("free");
}

export async function canUseModel(
  userId: string,
  modelId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!env.SUBSCRIPTION_ENABLED) {
    return { allowed: true };
  }

  const subscriptionResult = await checkActiveSubscription(userId);

  if (!subscriptionResult.success || !subscriptionResult.subscription) {
    return { allowed: false, reason: "Subscription check failed" };
  }

  const { limits } = subscriptionResult.subscription;

  if ((await isAdvancedModel(modelId)) && !limits.canUseAdvancedModels) {
    return {
      allowed: false,
      reason: "This advanced model is not available in your plan",
    };
  }

  return { allowed: true };
}
