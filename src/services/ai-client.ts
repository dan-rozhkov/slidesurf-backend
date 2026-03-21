import {
  generateText,
  streamText,
  type ModelMessage,
} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type AiModelId = string;

function resolveModelId(preferredModel?: string): AiModelId {
  return preferredModel || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
}

const provider = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  headers: {
    ...(process.env.OPENROUTER_REFERER && {
      "HTTP-Referer": process.env.OPENROUTER_REFERER,
    }),
    ...(process.env.OPENROUTER_TITLE && {
      "X-Title": process.env.OPENROUTER_TITLE,
    }),
  },
});

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function aiGenerateText(args: {
  system?: string;
  messages?: ModelMessage[];
  prompt?: string;
  model?: string;
  temperature?: number;
}): Promise<any> {
  const { system, messages, prompt, model, temperature } = args;

  if (messages) {
    return await generateText({
      model: provider(resolveModelId(model)),
      system,
      messages,
      temperature,
    });
  }

  if (prompt) {
    return await generateText({
      model: provider(resolveModelId(model)),
      system,
      prompt,
      temperature,
    });
  }

  throw new Error("Either 'messages' or 'prompt' must be provided");
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function aiStreamText(args: {
  system?: string;
  messages?: ModelMessage[];
  prompt?: string;
  model?: string;
  temperature?: number;
}): Promise<any> {
  const { system, messages, prompt, model, temperature } = args;

  if (messages) {
    return await streamText({
      model: provider(resolveModelId(model)),
      system,
      messages,
      temperature,
    });
  }

  if (prompt) {
    return await streamText({
      model: provider(resolveModelId(model)),
      system,
      prompt,
      temperature,
    });
  }

  throw new Error("Either 'messages' or 'prompt' must be provided");
}
