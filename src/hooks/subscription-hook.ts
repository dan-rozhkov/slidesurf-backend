import { FastifyRequest, FastifyReply } from "fastify";
import {
  getSubscriptionLimits,
  SubscriptionLimits,
} from "@/subscription-limits";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/subscriptions-schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { env } from "@/config/env";

declare module "fastify" {
  interface FastifyRequest {
    subscription: SubscriptionLimits;
  }
}

export async function subscriptionHook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.userId;

  if (!userId) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  if (!env.SUBSCRIPTION_ENABLED) {
    request.subscription = getSubscriptionLimits("pro");
    return;
  }

  const now = new Date();

  const [activeSubscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        lte(subscriptions.startDate, now),
        gte(subscriptions.endDate, now)
      )
    )
    .limit(1);

  const planType = activeSubscription?.planType || "free";
  request.subscription = getSubscriptionLimits(planType);
}
