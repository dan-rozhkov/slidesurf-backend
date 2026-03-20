import { aiGenerateText, aiStreamText } from "./ai-client";
import {
  createSlidesPlanPrompt,
  createSlidesGenerationPrompt,
} from "@/prompts/slide-prompts";
import { parseSlidesFromResponse } from "@/parsers/slide-parser";
import { readContent } from "@/retrieval/helpers/read-content";
import {
  SlidesGenerationParams,
  SlidesGenerationResult,
} from "@/shared/types/generation";

export async function generateSlides(
  params: SlidesGenerationParams
): Promise<SlidesGenerationResult> {
  const {
    prompt,
    slidesCount,
    slidesPlan,
    model,
    contentSettings,
    attachments,
  } = params;
  const defaultModel = process.env.OPENROUTER_MODEL_STRONG;

  let attachmentText = "";
  if (attachments && attachments.length > 0) {
    attachmentText = await readContent(attachments);
  }

  const slidesPlanPrompt = createSlidesPlanPrompt(slidesPlan || []);
  const systemPrompt = createSlidesGenerationPrompt(
    prompt,
    attachmentText,
    slidesCount,
    slidesPlanPrompt,
    contentSettings || { tone: "neutral", whom: "all", contentStyle: "less" }
  );

  const response = await aiGenerateText({
    prompt: systemPrompt,
    model: model || defaultModel,
  });

  const content = response.text || "";
  const slides = parseSlidesFromResponse(content);

  return {
    slides,
    attachmentText,
  };
}

export async function generateSlidesStream(params: SlidesGenerationParams) {
  const {
    prompt,
    slidesCount,
    slidesPlan,
    model,
    contentSettings,
    attachments,
  } = params;
  const defaultModel = process.env.OPENROUTER_MODEL_STRONG;

  let attachmentText = "";
  if (attachments && attachments.length > 0) {
    attachmentText = await readContent(attachments);
  }

  const slidesPlanPrompt = createSlidesPlanPrompt(slidesPlan || []);
  const systemPrompt = createSlidesGenerationPrompt(
    prompt,
    attachmentText,
    slidesCount,
    slidesPlanPrompt,
    contentSettings || { tone: "neutral", whom: "all", contentStyle: "less" }
  );

  const result = await aiStreamText({
    prompt: systemPrompt,
    model: model || defaultModel,
  });

  return result.textStream;
}
