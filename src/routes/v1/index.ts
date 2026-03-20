import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { auth } from "@/auth";
import { db } from "@/db";
import { nanoid } from "@/utils/nanoid";
import { presentations } from "@/db/schema/presentations-schema";
import { Slide } from "@/types";
import { fullPresentationGenerationSchema } from "@/shared/validators/generation-schemas";
import { generateFullPresentation } from "@/services/presentation-generation";

async function createPresentation(
  userId: string,
  title: string,
  slides: Slide[]
) {
  const [newPresentation] = await db
    .insert(presentations)
    .values({
      id: nanoid(),
      title: title,
      createdAt: new Date(),
      updatedAt: new Date(),
      themeId: "tech-community",
      isShared: true,
      slides,
      userId,
    })
    .returning();

  return newPresentation;
}

async function v1Routes(fastify: FastifyInstance) {
  // POST /api/v1/generate/slides - Generate slides via API key auth
  fastify.post(
    "/api/v1/generate/slides",
    async (request, reply) => {
      const apiKey = request.headers["x-api-key"] as string | undefined;

      if (!apiKey) {
        return reply.code(401).send({ error: "API key required" });
      }

      try {
        const { valid, error, key } = await auth.api.verifyApiKey({
          body: {
            key: apiKey,
          },
        });

        if (!valid) {
          return reply.code(403).send({ error: error });
        }

        const userId = key?.userId;

        if (!userId) {
          return reply.code(403).send({ error: "User not found" });
        }

        const params = fullPresentationGenerationSchema.parse(request.body);

        if (!params.title) {
          return reply.code(400).send({ error: "Title is required" });
        }

        // Generate full presentation using shared service
        const result = await generateFullPresentation(params);

        // Create presentation in database
        const presentation = await createPresentation(
          userId,
          result.presentation.title,
          result.presentation.slides
        );

        return reply.send({
          success: true,
          userId,
          presentationId: presentation.id,
          link: `${process.env.BETTER_AUTH_URL!}/present/${presentation.id}`,
          title: presentation.title,
          slidesCount: result.presentation.slides.length,
        });
      } catch (error) {
        console.error("Error generating presentation:", error);
        return reply.code(500).send({
          error:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  );
}

export default fp(v1Routes);
