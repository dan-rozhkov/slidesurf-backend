import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getAvailableModels } from "@/models";

export default fp(async (fastify: FastifyInstance) => {
  // GET /api/models — returns enabled text and image models
  fastify.get(
    "/api/models",
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const [textModels, imageModels] = await Promise.all([
          getAvailableModels("text"),
          getAvailableModels("image"),
        ]);

        return reply.send({ textModels, imageModels });
      } catch (error) {
        console.error("Error fetching models:", error);
        return reply.code(500).send({ error: "Failed to fetch models" });
      }
    }
  );
});
