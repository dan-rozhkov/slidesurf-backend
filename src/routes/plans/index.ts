import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { db } from "@/db";
import { presentationPlans } from "@/db/schema/presentation-plans-schema";
import { eq, and } from "drizzle-orm";
import { authHook } from "@/hooks/auth-hook";

const updatePlanSchema = z.object({
  slides: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        index: z.number().optional(),
        keyPoints: z.array(z.string()).optional(),
      })
    )
    .optional(),
  slidesCount: z.number().optional(),
});

export default fp(async (fastify: FastifyInstance) => {
  // GET /api/plans/:id - get plan research (auth required)
  fastify.get(
    "/api/plans/:id",
    { preHandler: [authHook] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = req.params;

        if (!id) {
          return reply.code(400).send({ error: "Plan ID is required" });
        }

        const plan = await db
          .select({ research: presentationPlans.research })
          .from(presentationPlans)
          .where(
            and(
              eq(presentationPlans.id, id),
              eq(presentationPlans.userId, req.userId)
            )
          )
          .limit(1);

        if (plan.length === 0) {
          return reply.code(404).send({ error: "Plan not found" });
        }

        return reply.send({ research: plan[0].research });
      } catch (error) {
        console.error("Error fetching plan:", error);
        return reply.code(500).send({
          error: "Error fetching plan",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // PATCH /api/plans/:id - update plan (auth required)
  fastify.patch(
    "/api/plans/:id",
    { preHandler: [authHook] },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = req.params;
        const { slides, slidesCount } = updatePlanSchema.parse(req.body);

        if (!id) {
          return reply.code(400).send({ error: "Plan ID is required" });
        }

        await db
          .update(presentationPlans)
          .set({
            ...(slides ? { slides } : {}),
            ...(slidesCount ? { slidesCount } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(presentationPlans.id, id),
              eq(presentationPlans.userId, req.userId)
            )
          );

        return reply.send({ message: "Plan updated successfully" });
      } catch (error) {
        console.error("Error updating plan:", error);
        return reply.code(500).send({
          error: "Error updating plan",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
});
