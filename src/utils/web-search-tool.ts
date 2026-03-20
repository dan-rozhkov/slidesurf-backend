import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const perplexityProvider = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  headers: {
    ...(process.env.OPENROUTER_REFERER && {
      "HTTP-Referer": process.env.OPENROUTER_REFERER,
    }),
  },
});

export function createWebSearchTool() {
  return {
    description: "Search the internet for current information, facts, news, or any topic.",
    inputSchema: z.object({
      query: z.string().describe("The search query or question to search for."),
    }),
    execute: async ({ query }: { query: string }) => {
      try {
        const result = await generateText({
          model: perplexityProvider("perplexity/sonar"),
          prompt: query,
        });

        const steps = result?.steps[0]?.content || [];

        const sources = Array.isArray(steps)
          ? steps
              .filter((item: any) => item.type === "source")
              .map((source: any) => ({
                type: "source" as const,
                url: source.url,
                title: source.title,
              }))
          : [];

        return { query, result: result.text, sources };
      } catch (error) {
        console.error("Web search error:", error);
        return {
          error: error instanceof Error ? error.message : "Failed to perform web search",
        };
      }
    },
  };
}
