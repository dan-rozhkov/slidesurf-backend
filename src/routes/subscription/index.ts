import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { v4 as uuidv4 } from "uuid";
import { addDays, format } from "date-fns";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  promoCodes,
  promoCodeUsages,
} from "@/db/schema/promo-codes-schema";
import { subscriptions } from "@/db/schema/subscriptions-schema";
import { authHook } from "@/hooks/auth-hook";
import { env } from "@/config/env";
import { getI18nFromHeader } from "@/utils/i18n";
import {
  checkActiveSubscription,
  getGenerationsCount,
} from "@/services/subscription-service";

export type PaymentMetadata = {
  user_id: string;
  plan_type: string;
  start_date: string;
  end_date: string;
  promo_code_id?: string;
  original_price?: number;
  discount_amount?: number;
  final_price?: number;
};

const PRICES: Record<string, number | undefined> = {
  plus: env.PLUS_PRICE,
  pro: env.PRO_PRICE,
};

const subscriptionSchema = z.object({
  planType: z.enum(["plus", "pro"]),
  promoCode: z
    .object({
      id: z.string(),
      code: z.string(),
      originalPrice: z.number(),
      discountAmount: z.number(),
      finalPrice: z.number(),
    })
    .optional(),
});

const notificationSchema = z.object({
  type: z.string(),
  event: z.string(),
  object: z.object({
    id: z.string(),
    status: z.string(),
    metadata: z.object({
      end_date: z.string(),
      plan_type: z.string(),
      user_id: z.string(),
      start_date: z.string(),
      promo_code_id: z.string().optional(),
      original_price: z
        .string()
        .transform((val) => Number(val))
        .optional(),
      discount_amount: z
        .string()
        .transform((val) => Number(val))
        .optional(),
      final_price: z
        .string()
        .transform((val) => Number(val))
        .optional(),
    }),
  }),
});

async function subscriptionRoutes(fastify: FastifyInstance) {
  // GET /api/subscription/current — get current subscription status
  fastify.get(
    "/api/subscription/current",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await checkActiveSubscription(req.userId);
        if (!result.success) {
          return reply.code(500).send({ error: result.error });
        }
        return reply.send(result.subscription);
      } catch (error) {
        console.error("Error fetching subscription:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch subscription" });
      }
    }
  );

  // GET /api/subscription/usage — get generations usage stats
  fastify.get(
    "/api/subscription/usage",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await checkActiveSubscription(req.userId);
        const limits = result.subscription?.limits;
        const limit = limits?.maxGenerationsPerMonth ?? 3;
        const used = await getGenerationsCount(req.userId, "month");
        return reply.send({
          used,
          limit,
          remaining: Math.max(0, limit - used),
        });
      } catch (error) {
        console.error("Error fetching usage:", error);
        return reply.code(500).send({ error: "Failed to fetch usage" });
      }
    }
  );

  // POST /api/subscription/process — create a payment (authenticated)
  fastify.post<{ Body: z.infer<typeof subscriptionSchema> }>(
    "/api/subscription/process",
    { onRequest: [authHook] },
    async (req, reply) => {
      const t = getI18nFromHeader(req.headers["accept-language"] as string);

      try {
        const userId = req.userId;
        const { planType, promoCode } = subscriptionSchema.parse(req.body);

        let planPrice = PRICES[planType];
        if (planPrice === undefined) {
          return reply
            .code(500)
            .send({ error: t.subscription.errors.configNotFound });
        }

        let discountAmount = 0;
        let originalPrice = planPrice;

        // If promo code is provided, validate it again and update the price
        if (promoCode) {
          const [promoCodeRecord] = await db
            .select()
            .from(promoCodes)
            .where(eq(promoCodes.id, promoCode.id))
            .limit(1);

          if (
            !promoCodeRecord ||
            !promoCodeRecord.isActive ||
            new Date() < promoCodeRecord.validFrom ||
            new Date() > promoCodeRecord.validUntil ||
            (promoCodeRecord.maxUses !== null &&
              promoCodeRecord.usedCount >= promoCodeRecord.maxUses)
          ) {
            return reply
              .code(400)
              .send({ error: t.promoCode.errors.invalidOrExpired });
          }

          planPrice = promoCode.finalPrice;
          discountAmount = promoCode.discountAmount;
          originalPrice = promoCode.originalPrice;
        }

        const planName = t.subscription.plans[planType];
        const paymentDescription = t.subscription.payment.description;
        const forMonth = t.subscription.payment.forMonth;

        const referer =
          (req.headers["referer"] as string) || env.BETTER_AUTH_URL;

        const metadata: PaymentMetadata = {
          user_id: userId,
          plan_type: planType,
          start_date:
            format(new Date(), "yyyy-MM-dd") + " 00:00:00+00",
          end_date:
            format(addDays(new Date(), 30), "yyyy-MM-dd") + " 00:00:00+00",
        };

        if (promoCode) {
          metadata.promo_code_id = promoCode.id;
          metadata.original_price = originalPrice;
          metadata.discount_amount = discountAmount;
          metadata.final_price = planPrice;
        }

        const shopId = env.YOUKASSA_SHOP_ID;
        const secretKey = env.YOUKASSA_SECRET_KEY;

        if (!shopId || !secretKey) {
          return reply
            .code(500)
            .send({ error: t.subscription.errors.configNotFound });
        }

        const credentials = Buffer.from(`${shopId}:${secretKey}`).toString(
          "base64"
        );

        const response = await fetch("https://api.yookassa.ru/v3/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${credentials}`,
            "Idempotence-Key": uuidv4(),
          },
          body: JSON.stringify({
            amount: {
              value: `${planPrice}.00`,
              currency: "RUB",
            },
            capture: true,
            confirmation: {
              type: "redirect",
              return_url: referer,
            },
            description: `${paymentDescription} ${planName} ${forMonth}`,
            metadata,
          }),
        });

        if (!response.ok) {
          const errorData: any = await response.json();
          return reply.code(response.status).send({
            error:
              errorData.description ||
              t.subscription.errors.paymentFailed,
          });
        }

        const payment = await response.json();
        return reply.send(payment);
      } catch (error) {
        console.error("Error in subscription process:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: t.subscription.errors.invalidData,
            details: error.errors,
          });
        }

        return reply
          .code(500)
          .send({ error: t.subscription.errors.serverError });
      }
    }
  );

  // POST /api/subscription/notification — YooKassa webhook (NO auth)
  fastify.post(
    "/api/subscription/notification",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { event, object } = notificationSchema.parse(req.body);

        // Only process payment.succeeded events
        if (event !== "payment.succeeded") {
          return reply.code(200).send("Event type not supported");
        }

        const { metadata } = object;

        if (object.status !== "succeeded") {
          return reply.code(200).send("Payment not succeeded");
        }

        // Check if subscription already exists
        const existingSubscription = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, object.id))
          .limit(1);

        if (existingSubscription.length > 0) {
          return reply.code(200).send("Subscription already exists");
        }

        // Create new subscription
        await db.insert(subscriptions).values({
          id: object.id,
          userId: metadata.user_id,
          planType: metadata.plan_type,
          startDate: new Date(metadata.start_date),
          endDate: new Date(metadata.end_date),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // If promo code was used, record usage and increment counter
        if (
          metadata.promo_code_id &&
          metadata.original_price &&
          metadata.discount_amount !== undefined &&
          metadata.final_price !== undefined
        ) {
          await db.insert(promoCodeUsages).values({
            id: uuidv4(),
            promoCodeId: metadata.promo_code_id,
            userId: metadata.user_id,
            planType: metadata.plan_type,
            originalPrice: metadata.original_price,
            discountAmount: metadata.discount_amount,
            finalPrice: metadata.final_price,
            usedAt: new Date(),
          });

          await db
            .update(promoCodes)
            .set({
              usedCount: sql`${promoCodes.usedCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(promoCodes.id, metadata.promo_code_id));
        }

        return reply.code(200).send("Subscription created successfully");
      } catch (error) {
        console.error("Error processing webhook:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send("Invalid webhook data");
        }

        return reply.code(500).send("Internal server error");
      }
    }
  );
}

export default fp(subscriptionRoutes, {
  name: "subscription-routes",
});
