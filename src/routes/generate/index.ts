import fp from "fastify-plugin";
import { z } from "zod";
import dedent from "dedent";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authHook } from "@/hooks/auth-hook";
import { subscriptionHook } from "@/hooks/subscription-hook";
import { generateSlidesStream } from "@/services/slides-generation";
import { generatePlanStream } from "@/services/plan-generation";
import { aiGenerateText } from "@/services/ai-client";
import {
  slidesGenerationSchema,
  planGenerationSchema,
} from "@/shared/validators/generation-schemas";
import { db } from "@/db";
import { presentationPlans } from "@/db/schema";
import { parseSectionsFromResponse } from "@/parsers/section-parser";
import {
  canPerformAction,
  canUseModel,
} from "@/services/subscription-service";
import { logUserAction } from "@/services/action-logger";
import {
  SLIDE_TEMPLATES,
  twoColsWithSubheadings,
  twoCols,
  threeCols,
  fourCols,
  cards,
  frontSlide,
  imageWithText,
  textWithImage,
  titleWithListOptionsAndImage,
  titleWithListOptions,
  titleWithFeaturesList,
  titleWithTimeline,
  arrowsHorizontal,
  pyramid,
  statistics,
} from "@/templates/new-slide-templates";
import { SlideAction, SlidesTemplates } from "@/types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fal } from "@fal-ai/client";
import { DEFAULT_IMAGE_MODEL, getModelById } from "@/models";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createSubscriptionErrorResponse(
  reply: FastifyReply,
  reason: string
) {
  return reply.code(403).send({ error: reason });
}

function calculateAutoSlidesCount(text: string): number {
  const DEFAULT_SLIDES_COUNT = 8;
  if (!text.includes("---")) return DEFAULT_SLIDES_COUNT;
  const sections = text.split("---").filter((s) => s.trim());
  return sections.length > 0 ? sections.length : DEFAULT_SLIDES_COUNT;
}

// ─── Slide template constants ───────────────────────────────────────────────

const WEIGHTED_TEMPLATES = [
  { key: SlidesTemplates.TWO_COLS_WITH_SUBHEADINGS, weight: 1.2 },
  { key: SlidesTemplates.TWO_COLS, weight: 1.2 },
  { key: SlidesTemplates.THREE_COLS, weight: 1.2 },
  { key: SlidesTemplates.FOUR_COLS, weight: 1.2 },
  { key: SlidesTemplates.CARDS, weight: 1.2 },
  { key: SlidesTemplates.FRONT_SLIDE, weight: 1.2 },
  { key: SlidesTemplates.IMAGE_WITH_TEXT, weight: 1.2 },
  { key: SlidesTemplates.TEXT_WITH_IMAGE, weight: 1.2 },
  { key: SlidesTemplates.TITLE_WITH_LIST_OPTIONS_AND_IMAGE, weight: 1.2 },
  { key: SlidesTemplates.TITLE_WITH_LIST_OPTIONS, weight: 1.2 },
  { key: SlidesTemplates.TITLE_WITH_FEATURES_LIST, weight: 1 },
  { key: SlidesTemplates.TITLE_WITH_TIMELINE, weight: 1 },
  { key: SlidesTemplates.ARROWS_HORIZONTAL, weight: 1 },
  { key: SlidesTemplates.PYRAMID, weight: 1 },
  { key: SlidesTemplates.STATISTICS, weight: 1 },
  { key: SlidesTemplates.BIG_NUMBERS, weight: 1 },
  { key: SlidesTemplates.RATING_STARS, weight: 1 },
  { key: SlidesTemplates.QUOTES, weight: 1 },
];

function getRandomTemplate(): SlidesTemplates {
  const totalWeight = WEIGHTED_TEMPLATES.reduce(
    (sum, { weight }) => sum + weight,
    0
  );
  let random = Math.random() * totalWeight;
  for (const { key, weight } of WEIGHTED_TEMPLATES) {
    random -= weight;
    if (random <= 0) return key;
  }
  return WEIGHTED_TEMPLATES[WEIGHTED_TEMPLATES.length - 1].key;
}

// ─── Quick-action prompts ───────────────────────────────────────────────────

const contentActionsPrompt: Record<SlideAction, string> = {
  [SlideAction.CHANGE_LAYOUT]: "Change slide layout",
  [SlideAction.SPELL_CHECK]: "Fix spelling and grammar",
  [SlideAction.TRANSLATE_TO_RUSSIAN]: "Translate to Russian",
  [SlideAction.WRITE_MORE_DETAILED]:
    "Write more detailed, but no more than 100 words.",
  [SlideAction.SHORTEN_TEXT]: "Shorten text",
  [SlideAction.SPLIT_INTO_ITEMS]: "Split text into bullet points",
  [SlideAction.SPLIT_INTO_SECTIONS]: "Split text into sections",
  [SlideAction.IMPROVE_TEXT]: "Improve text",
};

const selectedTextActionsPrompt: Record<SlideAction, string> = {
  [SlideAction.IMPROVE_TEXT]:
    "Improve the text quality, clarity and readability",
  [SlideAction.SPELL_CHECK]: "Fix spelling and grammar errors",
  [SlideAction.TRANSLATE_TO_RUSSIAN]: "Translate to Russian",
  [SlideAction.WRITE_MORE_DETAILED]:
    "Make the text more detailed and comprehensive, but keep it concise",
  [SlideAction.SHORTEN_TEXT]: "Make the text shorter and more concise",
  [SlideAction.CHANGE_LAYOUT]:
    "Change layout (not applicable for selected text)",
  [SlideAction.SPLIT_INTO_ITEMS]: "Split text into bullet points or list items",
  [SlideAction.SPLIT_INTO_SECTIONS]: "Split text into separate sections",
};

// ─── S3 client (for image generation) ───────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.AWS_ENDPOINT,
});

// ─── Schemas ────────────────────────────────────────────────────────────────

const slideSchema = z.object({
  slideContent: z.string(),
  template: z.union([z.nativeEnum(SlidesTemplates), z.literal("auto")]),
  lang: z.enum(["ru", "en"]),
});

const contentSchema = z.object({
  slideContent: z.string(),
  actionId: z.nativeEnum(SlideAction),
});

const imagePromptSchema = z.object({
  slideContent: z.string(),
});

const chartSchema = z.object({
  prompt: z.string().min(10),
});

const selectedTextSchema = z.object({
  selectedText: z.string(),
  userPrompt: z.string().optional(),
  actionId: z.nativeEnum(SlideAction).optional(),
});

const shuffleSchema = z.object({
  slideContent: z.string(),
});

// ─── Plugin ─────────────────────────────────────────────────────────────────

export default fp(async (fastify: FastifyInstance) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/slides  — stream slide generation
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/slides",
    { preHandler: [authHook, subscriptionHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      let {
        prompt,
        slidesCount = 5,
        slidesPlan,
        model,
        contentSettings = { tone: "neutral", whom: "all", contentStyle: "less" },
        attachments,
      } = slidesGenerationSchema.parse(req.body);

      if (!prompt) {
        return reply.code(400).send("Prompt is required");
      }

      if (slidesCount === -1) {
        slidesCount = calculateAutoSlidesCount(prompt);
      }

      const userId = req.userId;
      const subscription = req.subscription;

      // Check slides count limit
      const slidesCheck = await canPerformAction(
        userId,
        "maxSlidesPerGeneration",
        slidesCount
      );
      if (!slidesCheck.allowed) {
        return createSubscriptionErrorResponse(reply, slidesCheck.reason!);
      }

      // Check daily generation limit
      const dailyLimitCheck = await canPerformAction(
        userId,
        "maxGenerationsPerDay"
      );
      if (!dailyLimitCheck.allowed) {
        return createSubscriptionErrorResponse(reply, dailyLimitCheck.reason!);
      }

      // Check monthly generation limit
      const monthlyLimitCheck = await canPerformAction(
        userId,
        "maxGenerationsPerMonth"
      );
      if (!monthlyLimitCheck.allowed) {
        return createSubscriptionErrorResponse(reply, monthlyLimitCheck.reason!);
      }

      // Check attachments limit
      if (attachments && attachments.length > 0) {
        const attachmentsCheck = await canPerformAction(
          userId,
          "maxAttachmentsPerGeneration",
          attachments.length
        );
        if (!attachmentsCheck.allowed) {
          return createSubscriptionErrorResponse(
            reply,
            attachmentsCheck.reason!
          );
        }
      }

      // Check model access
      if (model) {
        const modelCheck = await canUseModel(userId, model);
        if (!modelCheck.allowed) {
          return createSubscriptionErrorResponse(reply, modelCheck.reason!);
        }
      }

      const response = await generateSlidesStream({
        prompt,
        slidesCount,
        slidesPlan,
        model,
        contentSettings,
        attachments,
      });

      // Stream the async iterable to the client
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Subscription-Plan": subscription?.planType || "free",
        "X-Subscription-Limits": JSON.stringify(subscription || {}),
      });

      try {
        for await (const chunk of response as AsyncIterable<string>) {
          reply.raw.write(chunk);
        }
        reply.raw.end();

        logUserAction({
          userId,
          actionType: "generate_slides",
          metadata: {
            slidesCount,
            model,
            attachmentsCount: attachments?.length || 0,
            contentSettings: JSON.stringify(contentSettings),
          },
          status: "success",
        });
      } catch (err) {
        reply.raw.end();

        logUserAction({
          userId,
          actionType: "generate_slides",
          metadata: {
            slidesCount,
            model,
            attachmentsCount: attachments?.length || 0,
            contentSettings: JSON.stringify(contentSettings),
          },
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "Stream processing error",
        });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/plan  — stream plan generation
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/plan",
    { preHandler: [authHook, subscriptionHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      let {
        title,
        slidesCount = 5,
        lang,
        model,
        useResearch,
        attachments,
      } = planGenerationSchema.parse(req.body);

      if (!title) {
        return reply.code(400).send("Title is required");
      }

      if (slidesCount === -1) {
        slidesCount = calculateAutoSlidesCount(title);
      }

      const userId = req.userId;
      const subscription = req.subscription;

      // Check slides count limit
      const slidesCheck = await canPerformAction(
        userId,
        "maxSlidesPerGeneration",
        slidesCount
      );
      if (!slidesCheck.allowed) {
        return createSubscriptionErrorResponse(reply, slidesCheck.reason!);
      }

      // Check attachments limit
      if (attachments && attachments.length > 0) {
        const attachmentsCheck = await canPerformAction(
          userId,
          "maxAttachmentsPerGeneration",
          attachments.length
        );
        if (!attachmentsCheck.allowed) {
          return createSubscriptionErrorResponse(
            reply,
            attachmentsCheck.reason!
          );
        }
      }

      // Check model access
      if (model) {
        const modelCheck = await canUseModel(userId, model);
        if (!modelCheck.allowed) {
          return createSubscriptionErrorResponse(reply, modelCheck.reason!);
        }
      }

      const { textStream, finalTitle, attachmentText, researchText } =
        await generatePlanStream({
          title,
          slidesCount,
          lang,
          model,
          useResearch,
          attachments,
        });

      const planId = crypto.randomUUID();

      // Stream the async iterable to the client
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Subscription-Plan": subscription?.planType || "free",
        "X-Subscription-Limits": JSON.stringify(subscription || {}),
        "X-Plan-Id": planId,
      });

      try {
        let fullContent = "";
        for await (const chunk of textStream as AsyncIterable<string>) {
          fullContent += chunk;
          reply.raw.write(chunk);
        }
        reply.raw.end();

        // Save to DB
        try {
          const sections = parseSectionsFromResponse(fullContent);
          await db.insert(presentationPlans).values({
            id: planId,
            userId,
            title: finalTitle,
            slides: sections,
            prompt: title,
            model: model,
            language: lang,
            slidesCount: slidesCount || 5,
            research: researchText || attachmentText,
          });
        } catch (dbError) {
          console.error("Error saving plan to DB:", dbError);
        }

        logUserAction({
          userId,
          actionType: "generate_plan",
          metadata: {
            slidesCount,
            model,
            attachmentsCount: attachments?.length || 0,
            lang,
            useResearch: Boolean(useResearch),
          },
          status: "success",
        });
      } catch (error) {
        console.error("Error in stream processing:", error);
        const errorResponse = JSON.stringify({
          error: "Stream processing error",
          message:
            error instanceof Error ? error.message : "errorGenerating",
        });
        reply.raw.write(errorResponse);
        reply.raw.end();

        logUserAction({
          userId,
          actionType: "generate_plan",
          metadata: {
            slidesCount,
            model,
            attachmentsCount: attachments?.length || 0,
            lang,
            useResearch: Boolean(useResearch),
          },
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Stream processing error",
        });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/slide  — generate single slide content for a template
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/slide",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = slideSchema.parse(req.body);
      let template: string | SlidesTemplates = parsed.template;
      const { slideContent, lang } = parsed;
      const userId = req.userId;
      const strongModel = process.env.OPENROUTER_MODEL_STRONG;

      if (!slideContent) {
        return reply.code(400).send("Slide content is required");
      }

      if (template === "auto") {
        template = getRandomTemplate();
      }

      const templateContent = SLIDE_TEMPLATES.find(
        (temp) => temp.name === (template as unknown as SlidesTemplates)
      );

      if (!templateContent) {
        return reply.code(400).send("Template not found");
      }

      try {
        const systemPrompt = `
      Follow these instructions:
      1. Analyze the provided slide_content and slide_template structure.
      2. Extract key information from the slide_content.
      3. Reorganize and format the content to perfectly match the slide_template structure.
      4. Maintain the original meaning and key points while adapting to the slide_template format.
      5. Return the response in HTML format.

      <slide_content>
      ${slideContent}
      </slide_content>

      <slide_template>
      ${templateContent.content}
      </slide_template>

      Requirements:
      - The output MUST strictly follow the template structure
      - Preserve all important information from the original content
      - Format the content to match the template's sections and layout
      - Return only the formatted HTML content without any additional text
      - Keep the same language as the input content
      - Do not wrap the response in \`\`\` tags
      - Do not wrap to <slide_template> tags
      - Response in HTML format
      - Return only the slide content without adding any comments
      - The slide should be in ${lang} language
    `;

        const response = await aiGenerateText({
          prompt: systemPrompt,
          model: strongModel,
        });

        logUserAction({
          userId,
          actionType: "generate_slide",
          metadata: {
            template,
            lang,
            model: strongModel || "unknown",
          },
          status: "success",
        });

        return reply.send({
          content: response.text,
          template,
        });
      } catch (error) {
        logUserAction({
          userId,
          actionType: "generate_slide",
          metadata: {
            template,
            lang,
            model: strongModel || "unknown",
          },
          status: "error",
          errorMessage:
            error instanceof Error ? error.message : "Slide generation error",
        });

        return reply.code(500).send("Error: " + error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/content  — apply action to slide content
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/content",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { slideContent, actionId } = contentSchema.parse(req.body);
      const userId = req.userId;

      if (!slideContent) {
        return reply.code(400).send("Slide content is required");
      }

      if (!actionId) {
        return reply.code(400).send("Action ID is required");
      }

      try {
        const result = await aiGenerateText({
          model: process.env.OPENROUTER_MODEL_STRONG,
          prompt: `
    Based on the slide content, perform the following action:
    <action>
    ${contentActionsPrompt[actionId]}.
    </action>

    <slide_content>
    ${slideContent}
    </slide_content>

    Requirements:
    - Do not wrap the response in \`\`\` tags
    - The response should be in the same language as the slide content
    - Response in HTML format
    - Return only the slide content without adding any comments
    `,
        });

        logUserAction({
          userId,
          actionType: "generate_content",
          metadata: {
            actionId,
            model: process.env.OPENROUTER_MODEL_STRONG || "unknown",
          },
          status: "success",
        });

        return reply.send(result.text);
      } catch (error) {
        logUserAction({
          userId,
          actionType: "generate_content",
          metadata: {
            actionId,
            model: process.env.OPENROUTER_MODEL_STRONG || "unknown",
          },
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Content generation error",
        });

        return reply.code(500).send("Error: " + error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/image  — generate image via fal.ai and upload to S3
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/image",
    { preHandler: [authHook, subscriptionHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { prompt, model } = req.body as { prompt: string; model?: string };
      const userId = req.userId;
      const subscription = req.subscription;

      fal.config({
        credentials: process.env.FAL_API_KEY,
        proxyUrl: "http://talkpilot-ai.twc1.net",
      });

      // Check image generation access
      const imageCheck = await canPerformAction(
        userId,
        "canUseImageGeneration"
      );
      if (!imageCheck.allowed) {
        return createSubscriptionErrorResponse(reply, imageCheck.reason!);
      }

      const selectedModel = model || DEFAULT_IMAGE_MODEL;

      // Check if user can use advanced image models
      const modelInfo = getModelById(selectedModel);
      if (modelInfo?.advanced) {
        if (!subscription?.canUseAdvancedImageModels) {
          return createSubscriptionErrorResponse(
            reply,
            "Advanced image models are only available on Pro plan"
          );
        }
      }

      const { text } = await aiGenerateText({
        model: process.env.OPENROUTER_MODEL,
        system: `Translate the provided text inside <text></text> tag to English. Return the translated text only.`,
        prompt: `<text>${prompt}</text>`,
      });

      try {
        const result = await fal.subscribe(selectedModel, {
          input: {
            prompt: text ?? prompt,
            image_size: "square_hd",
            num_images: 1,
            enable_safety_checker: true,
          },
        });

        const falImageUrl = (result.data as any).images[0].url;

        // Download image from fal URL
        const imageResponse = await fetch(falImageUrl);
        if (!imageResponse.ok) {
          throw new Error("Failed to download image from fal");
        }

        const imageBuffer = await imageResponse.arrayBuffer();

        const contentType =
          imageResponse.headers.get("content-type") || "image/webp";
        const extension = contentType.split("/")[1] || "webp";

        // Upload to S3
        const filename = `generated/${Date.now()}.${extension}`;
        const params = {
          Bucket: process.env.NEXT_PUBLIC_AWS_BUCKET_NAME!,
          Key: filename,
          Body: Buffer.from(imageBuffer),
          ContentType: contentType,
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        const imageUrl = `${process.env.NEXT_PUBLIC_AWS_ENDPOINT}/${process.env.NEXT_PUBLIC_AWS_BUCKET_NAME}/${filename}`;

        logUserAction({
          userId,
          actionType: "generate_image",
          metadata: {
            model: selectedModel,
            hasPrompt: !!prompt,
          },
          status: "success",
        });

        return reply
          .headers({
            "X-Subscription-Plan": subscription?.planType || "free",
            "X-Subscription-Limits": JSON.stringify(subscription || {}),
          })
          .send({ prompt, imageUrl });
      } catch (error: unknown) {
        console.log("error", error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";

        logUserAction({
          userId,
          actionType: "generate_image",
          metadata: {
            model: selectedModel,
            hasPrompt: !!prompt,
          },
          status: "error",
          errorMessage,
        });

        return reply.code(500).send({ message: errorMessage });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/image/prompt  — generate CLIP prompt from slide content
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/image/prompt",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { slideContent } = imagePromptSchema.parse(req.body);

      if (!slideContent) {
        return reply.code(400).send("Slide content is required");
      }

      try {
        const result = await aiGenerateText({
          prompt: `
    Based on the slide content, generate a CLIP-formatted prompt for image generation using FLUX model:

    <slide_content>
    ${slideContent}
    </slide_content>

    Requirements:
    - Generate prompt in CLIP format: comma-separated descriptive phrases
    - Structure: main subject, key details, lighting, quality modifiers, textures, camera angle, artistic style
    - Example format: "ancient oak tree, sprawling roots, golden hour light, ultra high resolution, realistic bark texture, dramatic low angle shot, cinematic"
    - The prompt must be in English
    - Related to the slide content
    - Use descriptive keywords and short phrases only
    - No numbers, no complex terms, no special characters
    - Return ONLY the comma-separated prompt, nothing else
    - Do not wrap the response in \`\`\` tags
    `,
          model: process.env.OPENROUTER_MODEL,
        });
        const text = result.text.trim();

        return reply.send(text);
      } catch (error) {
        return reply.code(500).send("Error: " + error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/chart  — generate chart data from prompt
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/chart",
    { preHandler: [authHook, subscriptionHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { prompt } = chartSchema.parse(req.body);
      const userId = req.userId;
      const subscription = req.subscription;
      const strongModel = process.env.OPENROUTER_MODEL_STRONG;

      if (!prompt) {
        return reply.code(400).send("Prompt is required");
      }

      // Check chart generation access
      const chartCheck = await canPerformAction(
        userId,
        "canUseChartGeneration"
      );
      if (!chartCheck.allowed) {
        return createSubscriptionErrorResponse(reply, chartCheck.reason!);
      }

      // Check model access
      if (!strongModel) {
        return reply.code(500).send("Model configuration not found");
      }

      const modelCheck = await canUseModel(userId, strongModel);
      if (!modelCheck.allowed) {
        return createSubscriptionErrorResponse(reply, modelCheck.reason!);
      }

      const systemPrompt = dedent`
        You are a chart generator.
        You need to create a chart for the following prompt:

        <prompt>
        ${prompt}
        </prompt>

        Answer STRICTLY in JSON format provider the following fields:

        <format>
          data: [{name: string, values: number[]}, ...]
          headers: [string, ...]
          chartType: "bar" | "line" | "pie" | "area"
          showLabels: true | false
        </format>

        Requirements:
        - Do not wrap the response in \`\`\`json tags
        - Return only JSON object, nothing else
      `;

      try {
        const response = await aiGenerateText({
          prompt: systemPrompt,
          model: strongModel,
        });

        let content = response.text;

        if (content?.startsWith("```json")) {
          content = content.replace("```json", "").replace("```", "");
        }

        logUserAction({
          userId,
          actionType: "generate_chart",
          metadata: {
            model: strongModel,
            hasPrompt: !!prompt,
          },
          status: "success",
        });

        return reply
          .type("application/json")
          .headers({
            "X-Subscription-Plan": subscription?.planType || "free",
            "X-Subscription-Limits": JSON.stringify(subscription || {}),
          })
          .send(content);
      } catch (error) {
        logUserAction({
          userId,
          actionType: "generate_chart",
          metadata: {
            model: strongModel,
            hasPrompt: !!prompt,
          },
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Chart generation error",
        });

        throw error;
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/selected-text  — apply action to selected text
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/selected-text",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { selectedText, userPrompt, actionId } =
        selectedTextSchema.parse(req.body);
      const userId = req.userId;

      if (!selectedText) {
        return reply.code(400).send("Selected text is required");
      }

      if (!userPrompt && !actionId) {
        return reply
          .code(400)
          .send("Either user prompt or action ID is required");
      }

      try {
        let instruction: string;

        if (actionId && selectedTextActionsPrompt[actionId]) {
          instruction = selectedTextActionsPrompt[actionId];
        } else if (userPrompt) {
          instruction = userPrompt;
        } else {
          return reply.code(400).send("Invalid action or prompt");
        }

        const result = await aiGenerateText({
          model: process.env.OPENROUTER_MODEL,
          prompt: `
    You are helping to edit selected text based on the given instruction.

    <instruction>
    ${instruction}
    </instruction>

    <selected_text>
    ${selectedText}
    </selected_text>

    Requirements:
    - Apply the instruction to the selected text
    - Do not wrap the response in \`\`\` tags
    - The response should be in the same language as the selected text unless translation is requested
    - Return only the modified text without adding any comments or explanations
    - Preserve the formatting and structure of the original text where appropriate
    - For improvements, focus on clarity, readability, and conciseness
    - For spell check, fix only spelling and grammar errors
    - For translations, translate the entire text accurately
    - Do not add a new line at the end of the response
    `,
        });

        logUserAction({
          userId,
          actionType: "generate_selected_text",
          metadata: {
            actionId: actionId || "custom",
            hasUserPrompt: !!userPrompt,
            model: process.env.OPENROUTER_MODEL || "unknown",
          },
          status: "success",
        });

        return reply.send(result.text.trim());
      } catch (error) {
        logUserAction({
          userId,
          actionType: "generate_selected_text",
          metadata: {
            actionId: actionId || "custom",
            hasUserPrompt: !!userPrompt,
            model: process.env.OPENROUTER_MODEL || "unknown",
          },
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Selected text generation error",
        });

        return reply.code(500).send("Error: " + error);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/generate/shuffle  — shuffle slide into a random template
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/generate/shuffle",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { slideContent } = shuffleSchema.parse(req.body);
      const strongModel = process.env.OPENROUTER_MODEL_STRONG;

      if (!slideContent) {
        return reply.code(400).send("Slide content is required");
      }

      // Weighted random template selection (matches original shuffle logic)
      const SHUFFLE_TEMPLATES = [
        { template: twoColsWithSubheadings, weight: 1.2 },
        { template: twoCols, weight: 1.2 },
        { template: threeCols, weight: 1.2 },
        { template: fourCols, weight: 1.2 },
        { template: cards, weight: 1.2 },
        { template: frontSlide, weight: 1.2 },
        { template: imageWithText, weight: 1.2 },
        { template: textWithImage, weight: 1.2 },
        { template: titleWithListOptionsAndImage, weight: 1.2 },
        { template: titleWithListOptions, weight: 1.2 },
        { template: titleWithFeaturesList, weight: 1 },
        { template: titleWithTimeline, weight: 1 },
        { template: arrowsHorizontal, weight: 1 },
        { template: pyramid, weight: 1 },
        { template: statistics, weight: 1 },
      ];

      function getRandomShuffleTemplate() {
        const totalWeight = SHUFFLE_TEMPLATES.reduce(
          (sum, { weight }) => sum + weight,
          0
        );
        let random = Math.random() * totalWeight;
        for (const { template: t, weight } of SHUFFLE_TEMPLATES) {
          random -= weight;
          if (random <= 0) return t;
        }
        return SHUFFLE_TEMPLATES[SHUFFLE_TEMPLATES.length - 1].template;
      }

      const template = getRandomShuffleTemplate();

      try {
        const systemPrompt = `
    Follow these instructions:
    1. Analyze the provided slide_content and slide_template structure.
    2. Extract key information from the slide_content.
    3. Reorganize and format the content to perfectly match the slide_template structure.
    4. Maintain the original meaning and key points while adapting to the slide_template format.
    5. Return the response in HTML format.

    <slide_content>
    ${slideContent}
    </slide_content>

    <slide_template>
    ${template?.content}
    </slide_template>

    Requirements:
    - The output MUST strictly follow the template structure
    - Preserve all important information from the original content
    - Format the content to match the template's sections and layout
    - Return only the formatted HTML content without any additional text
    - Keep the same language as the input content
    - Do not wrap the response in \`\`\` tags
    - Do not wrap to <slide_template> tags
    - Response in HTML format
    - Return only the slide content without adding any comments
    `;

        const response = await aiGenerateText({
          prompt: systemPrompt,
          model: strongModel,
        });

        return reply.send({
          content: response.text,
          template: {
            layout: template.layout,
            verticalAlign: template.verticalAlign,
          },
        });
      } catch (error) {
        return reply.code(500).send("Error: " + error);
      }
    }
  );
});
