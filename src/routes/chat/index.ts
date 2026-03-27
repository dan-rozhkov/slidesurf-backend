import fp from "fastify-plugin";
import { Readable } from "stream";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import dedent from "dedent";
import { authHook } from "@/hooks/auth-hook";
import { logUserAction } from "@/services/action-logger";
import { createChatTools } from "@/utils/chat-tools";

const provider = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  headers: {
    ...(process.env.OPENROUTER_REFERER && {
      "HTTP-Referer": process.env.OPENROUTER_REFERER,
    }),
  },
});

function resolveModelId(preferredModel?: string): string {
  return preferredModel || process.env.OPENROUTER_MODEL_STRONG || "qwen/qwen3-235b-a22b-2507";
}

const MAX_MESSAGES_TO_MODEL = 10;

const chatSchema = z.object({
  messages: z.array(z.any()).min(1) as z.ZodType<UIMessage[]>,
  model: z.string().optional(),
  webSearch: z.boolean().optional(),
  slideId: z.string().optional(),
  presentationId: z.string().optional(),
});

export default fp(async (fastify: FastifyInstance) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/chat  — AI chat with tool usage, streaming via AI SDK
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post(
    "/api/chat",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.userId;

      try {
        const { messages, model, webSearch, slideId, presentationId } =
          chatSchema.parse(req.body);

        const tools = createChatTools(userId, presentationId, slideId);

        // Keep only the most recent messages to respect the model context limit
        const limitedMessages =
          messages.length > MAX_MESSAGES_TO_MODEL
            ? messages.slice(-MAX_MESSAGES_TO_MODEL)
            : messages;

        // Build system prompt with context information
        const systemPrompt = dedent`
          You are an AI assistant helping the user work on their presentation.
          ${
            presentationId
              ? `You have access to a presentation (ID: ${presentationId}).`
              : ""
          }
          ${
            slideId
              ? `You are currently working on a specific slide (ID: ${slideId}).`
              : ""
          }

          You can use the available tools to read and update presentation slides.
          When the user asks about slide content or wants to modify it, use the tools to access and update the slides.
          If presentationId or slideId are provided in the request context, you can omit them when calling tools - they will be used automatically.

          You also have access to a web search tool that uses Perplexity Sonar to search the internet for current information.
          Use the webSearch tool when you need up-to-date information, facts, news, or when the user explicitly asks you to search the web.

          RULES:
          - Do not show slideId and presentationId in the response.
          - Do not return generated slide content to the chat history.
          - IMPORTANT: Before updating or replacing slide content, ALWAYS first read the current slide content using the getSlideContent tool. Never update a slide without reading it first.
          - When editing or replacing slide content, preserve the existing HTML structure and layout of the slide. Only change the text, data, or specific elements the user asked to modify. Do not regenerate the entire slide from scratch.
          - At the end of the response, always suggest improvements for the slide.

          CHARTS:
          When the user asks to add or modify a chart, use this HTML format:
          <div data-type="chart" data-chart-type="TYPE" data-show-labels="true" data-data='DATA_JSON'>Chart Data</div>

          Supported chart types: bar, line, pie, area, donut, h-bar, radar, radial-bar, waterfall

          The data-data attribute is a JSON array of rows. First row is headers, the rest are data rows. Each cell is {"value":"..."} where every value is a string:
          [[{"value":"Category"},{"value":"Series 1"},{"value":"Series 2"}],[{"value":"A"},{"value":"45"},{"value":"30"}],[{"value":"B"},{"value":"60"},{"value":"25"}]]

          Chart rules:
          - The first column contains category labels (text). All other columns contain ONLY numeric values represented as strings (e.g. "45", "100", "3.5"). NEVER put text like "Good", "High", or any non-numeric value in data columns.
          - ALWAYS fill chart data with realistic, meaningful numeric values. Never leave data-data empty or incomplete.
          - Use single quotes around the data-data attribute value (JSON inside uses double quotes)
          - For pie/donut charts use two columns: category + value. For bar/line/area use category + one or more value columns
          - Charts can be placed standalone or inside a column (<div data-type="column">) layout
          - When modifying an existing chart, preserve the data-type="chart" div and only update data-data or data-chart-type

          <additional_data>
          Today is ${new Date().toLocaleDateString()}.
          </additional_data>
        `;

        const selectedModel = resolveModelId(model);

        const result = streamText({
          model: provider(selectedModel),
          messages: await convertToModelMessages(limitedMessages),
          system: systemPrompt,
          tools,
          stopWhen: stepCountIs(5),
        });

        // Log successful chat interaction start
        logUserAction({
          userId,
          actionType: "chat",
          metadata: {
            messagesCount: limitedMessages.length,
            originalMessagesCount: messages.length,
            model: selectedModel || "unknown",
          },
          status: "success",
        });

        // Pipe the AI SDK Web Response to the raw Node.js response
        const response = result.toUIMessageStreamResponse({
          sendSources: true,
          sendReasoning: true,
        });

        reply.hijack();

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const origin = req.headers.origin;
        if (origin && origin === process.env.FRONTEND_URL) {
          headers["Access-Control-Allow-Origin"] = origin;
          headers["Access-Control-Allow-Credentials"] = "true";
        }

        reply.raw.writeHead(response.status, headers);

        if (response.body) {
          const nodeStream = Readable.fromWeb(
            response.body as import("stream/web").ReadableStream
          );
          nodeStream.pipe(reply.raw);
        } else {
          reply.raw.end();
        }
      } catch (error) {
        console.error("Error in POST processing:", error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: "Invalid request data",
            details: error.errors,
          });
        }

        // Log failed chat interaction
        logUserAction({
          userId,
          actionType: "chat",
          metadata: {
            messagesCount: 0,
            model: process.env.OPENROUTER_MODEL || "unknown",
          },
          status: "error",
          errorMessage:
            error instanceof Error ? error.message : "Chat processing error",
        });

        return reply.code(500).send("Internal Server Error");
      }
    }
  );
});
