import { aiGenerateText, aiStreamText } from "./ai-client";
import {
  createTitleGenerationPrompt,
  createPlanGenerationPrompt,
} from "@/prompts/plan-prompts";
import { parseSectionsFromResponse } from "@/parsers/section-parser";
import { readContent } from "@/retrieval/helpers/read-content";
import {
  PlanGenerationParams,
  PlanGenerationResult,
} from "@/shared/types/generation";
import { runWebResearch } from "@/services/web-research";

const MAX_TITLE_LENGTH = 150;

export async function generatePlan(
  params: PlanGenerationParams
): Promise<PlanGenerationResult> {
  const { title, slidesCount, lang, model, attachments, useResearch } = params;

  let attachmentText = "";
  if (attachments && attachments.length > 0) {
    attachmentText = await readContent(attachments);
  }

  let researchText = "";
  let researchSummary = "";
  if (useResearch) {
    const researchResult = await runWebResearch({ title, lang });
    researchText = researchResult.raw;
    researchSummary = researchResult.summary;
  }

  let finalTitle = title;
  const researchLabel =
    lang === "ru" ? "Краткое исследование из веба:" : "Web research summary:";
  const baseContent = [
    attachmentText,
    researchSummary ? `${researchLabel}\n${researchSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let finalContent = baseContent;

  if (title.length > MAX_TITLE_LENGTH) {
    const titleGenerationPrompt = createTitleGenerationPrompt(title, lang);

    const titleResponse = await aiGenerateText({
      prompt: titleGenerationPrompt,
      model: model,
    });

    finalTitle =
      titleResponse.text.trim() || title.substring(0, MAX_TITLE_LENGTH);
    finalContent = [title, baseContent].filter(Boolean).join("\n\n");
  }

  const systemPrompt = createPlanGenerationPrompt(
    finalTitle,
    finalContent,
    slidesCount,
    lang
  );

  const response = await aiGenerateText({
    prompt: systemPrompt,
    model: model,
  });

  const content = response.text || "";
  const sections = parseSectionsFromResponse(content);

  return {
    sections,
    finalTitle,
    attachmentText,
    researchText,
  };
}

export async function generatePlanStream(params: PlanGenerationParams) {
  const { title, slidesCount, lang, model, attachments, useResearch } = params;

  let attachmentText = "";
  if (attachments && attachments.length > 0) {
    attachmentText = await readContent(attachments);
  }

  let researchText = "";
  let researchSummary = "";
  if (useResearch) {
    const researchResult = await runWebResearch({ title, lang });
    researchText = researchResult.raw;
    researchSummary = researchResult.summary;
  }

  let finalTitle = title;
  const researchLabel =
    lang === "ru" ? "Краткое исследование из веба:" : "Web research summary:";
  const baseContent = [
    attachmentText,
    researchSummary ? `${researchLabel}\n${researchSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let finalContent = baseContent;

  if (title.length > MAX_TITLE_LENGTH) {
    const titleGenerationPrompt = createTitleGenerationPrompt(title, lang);

    const titleResponse = await aiGenerateText({
      prompt: titleGenerationPrompt,
      model: model,
    });

    finalTitle =
      titleResponse.text.trim() || title.substring(0, MAX_TITLE_LENGTH);
    finalContent = [title, baseContent].filter(Boolean).join("\n\n");
  }

  const systemPrompt = createPlanGenerationPrompt(
    finalTitle,
    finalContent,
    slidesCount,
    lang
  );

  const result = await aiStreamText({
    prompt: systemPrompt,
    model: model,
  });

  return {
    textStream: result.textStream,
    finalTitle,
    attachmentText,
    researchText,
  };
}
