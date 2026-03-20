import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { db } from "@/db";
import { promoCodes } from "@/db/schema/promo-codes-schema";
import { eq } from "drizzle-orm";
import { authHook } from "@/hooks/auth-hook";
import { getI18nFromHeader } from "@/utils/i18n";

const validatePromoCodeSchema = z.object({
  code: z.string().min(1),
  planType: z.enum(["plus", "pro"]),
});

export default fp(async (fastify: FastifyInstance) => {
  // POST /api/promo-code/validate - validate a promo code (auth required)
  fastify.post(
    "/api/promo-code/validate",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const t = getI18nFromHeader(req.headers["accept-language"] as string);

      try {
        const json = req.body;
        const { code, planType } = validatePromoCodeSchema.parse(json);

        // Find promo code
        const [promoCode] = await db
          .select()
          .from(promoCodes)
          .where(eq(promoCodes.code, code.toUpperCase()))
          .limit(1);

        if (!promoCode) {
          const errorMessage = (t as any)?.promoCode?.errors?.notFound ?? "Promo code not found";
          return reply.code(404).send({ error: errorMessage });
        }

        // Check if promo code is active
        if (!promoCode.isActive) {
          const errorMessage = (t as any)?.promoCode?.errors?.inactive ?? "Promo code is inactive";
          return reply.code(400).send({ error: errorMessage });
        }

        // Check validity dates
        const now = new Date();
        if (now < promoCode.validFrom || now > promoCode.validUntil) {
          const errorMessage = (t as any)?.promoCode?.errors?.expired ?? "Promo code has expired";
          return reply.code(400).send({ error: errorMessage });
        }

        // Check usage limit
        if (
          promoCode.maxUses !== null &&
          promoCode.usedCount >= promoCode.maxUses
        ) {
          const errorMessage = (t as any)?.promoCode?.errors?.maxUsesReached ?? "Promo code max uses reached";
          return reply.code(400).send({ error: errorMessage });
        }

        // Check if promo code is valid for this plan type
        if (promoCode.planTypes) {
          const validPlanTypes = promoCode.planTypes.split(",");
          if (!validPlanTypes.includes(planType)) {
            const errorMessage = (t as any)?.promoCode?.errors?.invalidPlan ?? "Promo code not valid for this plan";
            return reply.code(400).send({ error: errorMessage });
          }
        }

        // Calculate discount
        const originalPrice =
          planType === "plus"
            ? Number(process.env.NEXT_PUBLIC_PLUS_PRICE)
            : Number(process.env.NEXT_PUBLIC_PRO_PRICE);

        let discountAmount = 0;
        if (promoCode.discountType === "percentage") {
          discountAmount = Math.round(
            (originalPrice * promoCode.discountValue) / 100
          );
        } else {
          discountAmount = promoCode.discountValue;
        }

        // Ensure discount doesn't exceed original price
        discountAmount = Math.min(discountAmount, originalPrice);
        const finalPrice = Math.max(0, originalPrice - discountAmount);

        return reply.send({
          valid: true,
          promoCode: {
            id: promoCode.id,
            code: promoCode.code,
            discountType: promoCode.discountType,
            discountValue: promoCode.discountValue,
          },
          pricing: {
            originalPrice,
            discountAmount,
            finalPrice,
          },
        });
      } catch (error) {
        console.error("Error validating promo code:", error);

        if (error instanceof z.ZodError) {
          const errorMessage = (t as any)?.promoCode?.errors?.invalidData ?? "Invalid promo code data";
          return reply.code(400).send({
            error: errorMessage,
            details: error.errors,
          });
        }

        const errorMessage = (t as any)?.promoCode?.errors?.serverError ?? "Server error";
        return reply.code(500).send({ error: errorMessage });
      }
    }
  );
});
