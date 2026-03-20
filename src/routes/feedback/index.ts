import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authHook } from "@/hooks/auth-hook";
import { logUserAction } from "@/services/action-logger";

export default fp(async (fastify: FastifyInstance) => {
  // POST /api/feedback/rating - submit presentation rating (auth required)
  fastify.post(
    "/api/feedback/rating",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { presentationId, rating } = req.body as {
          presentationId: string;
          rating: number;
        };

        if (!presentationId || !rating || rating < 1 || rating > 4) {
          return reply.code(400).send({ error: "Invalid request data" });
        }

        await logUserAction({
          userId: req.userId,
          actionType: "presentation_feedback",
          metadata: {
            presentationId,
            rating,
          },
          status: "success",
        });

        return reply.send({ success: true });
      } catch (error) {
        console.error("Error saving feedback:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
});
