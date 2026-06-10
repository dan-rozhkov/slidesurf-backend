import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { nanoid } from "@/utils/nanoid";
import { presentations } from "@/db/schema/presentations-schema";
import { Slide } from "@/types";
import { fullPresentationGenerationSchema } from "@/shared/validators/generation-schemas";
import { generateFullPresentation } from "@/services/presentation-generation";
import { canPerformAction } from "@/services/subscription-service";
import { logUserAction } from "@/services/action-logger";

const v1GenerateSchema = fullPresentationGenerationSchema.extend({
  isShared: z.boolean().optional().default(false),
});

async function createPresentation(
  userId: string,
  title: string,
  slides: Slide[],
  isShared: boolean
) {
  const [newPresentation] = await db
    .insert(presentations)
    .values({
      id: nanoid(),
      title: title,
      createdAt: new Date(),
      updatedAt: new Date(),
      themeId: "tech-community",
      isShared,
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
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const apiKey = request.headers["x-api-key"] as string | undefined;

      if (!apiKey) {
        return reply.code(401).send({ error: "API key required" });
      }

      let userId: string;
      try {
        const { valid, error, key } = await auth.api.verifyApiKey({
          body: {
            key: apiKey,
          },
        });

        if (!valid) {
          return reply.code(403).send({ error: error });
        }

        if (!key?.userId) {
          return reply.code(403).send({ error: "User not found" });
        }
        userId = key.userId;
      } catch (error) {
        request.log.error(error, "Error verifying API key");
        return reply.code(500).send({ error: "Internal server error" });
      }

      let params: z.infer<typeof v1GenerateSchema>;
      try {
        params = v1GenerateSchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }
        return reply.code(400).send({ error: "Invalid request body" });
      }

      if (!params.title) {
        return reply.code(400).send({ error: "Title is required" });
      }

      // API-key generations are gated by the same subscription limits as the app
      const slidesCheck = await canPerformAction(
        userId,
        "maxSlidesPerGeneration",
        params.slidesCount
      );
      if (!slidesCheck.allowed) {
        return reply.code(403).send({ error: slidesCheck.reason });
      }

      const dailyLimitCheck = await canPerformAction(
        userId,
        "maxGenerationsPerDay"
      );
      if (!dailyLimitCheck.allowed) {
        return reply.code(429).send({ error: dailyLimitCheck.reason });
      }

      const monthlyLimitCheck = await canPerformAction(
        userId,
        "maxGenerationsPerMonth"
      );
      if (!monthlyLimitCheck.allowed) {
        return reply.code(429).send({ error: monthlyLimitCheck.reason });
      }

      if (params.attachments && params.attachments.length > 0) {
        const attachmentsCheck = await canPerformAction(
          userId,
          "maxAttachmentsPerGeneration",
          params.attachments.length
        );
        if (!attachmentsCheck.allowed) {
          return reply.code(403).send({ error: attachmentsCheck.reason });
        }
      }

      try {
        // Generate full presentation using shared service
        const result = await generateFullPresentation(params);

        // Create presentation in database
        const presentation = await createPresentation(
          userId,
          result.presentation.title,
          result.presentation.slides,
          params.isShared
        );

        logUserAction({
          userId,
          actionType: "generate_slides",
          metadata: {
            slidesCount: params.slidesCount,
            attachmentsCount: params.attachments?.length || 0,
            source: "v1-api",
          },
          status: "success",
        });

        return reply.send({
          success: true,
          userId,
          presentationId: presentation.id,
          isShared: presentation.isShared,
          ...(presentation.isShared && {
            link: `${process.env.BETTER_AUTH_URL!}/present/${presentation.id}`,
          }),
          title: presentation.title,
          slidesCount: result.presentation.slides.length,
        });
      } catch (error) {
        request.log.error(error, "Error generating presentation");

        logUserAction({
          userId,
          actionType: "generate_slides",
          metadata: {
            slidesCount: params.slidesCount,
            attachmentsCount: params.attachments?.length || 0,
            source: "v1-api",
          },
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });

        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}

export default fp(v1Routes);
