import { Presentation, Section, Slide } from "@/types";
import { generatePlan } from "./plan-generation";
import { generateSlides } from "./slides-generation";
import { nanoid } from "@/utils/nanoid";
import { DEFAULT_MODEL } from "@/models";
import {
  FullPresentationGenerationParams,
  PlanGenerationParams,
  SlidesGenerationParams,
} from "@/shared/types/generation";

export type FullPresentationGenerationResult = {
  presentation: Omit<Presentation, "userId" | "createdAt" | "updatedAt">;
  sections: Section[];
  slides: Slide[];
  finalTitle: string;
  attachmentText: string;
};

export async function generateFullPresentation(
  params: FullPresentationGenerationParams
): Promise<FullPresentationGenerationResult> {
  const {
    title,
    slidesCount = 8,
    lang = "ru",
    model,
    attachments,
    contentSettings = { tone: "neutral", whom: "all", contentStyle: "less" },
  } = params;

  // 1. Generate plan
  const planParams: PlanGenerationParams = {
    title,
    slidesCount,
    lang,
    model: model || DEFAULT_MODEL,
    attachments,
  };

  const planResult = await generatePlan(planParams);

  // 2. Generate slides
  const slidesParams: SlidesGenerationParams = {
    prompt: title,
    slidesCount,
    slidesPlan: planResult.sections,
    model,
    contentSettings,
    attachments,
  };

  const slidesResult = await generateSlides(slidesParams);

  // 3. Create presentation object
  const presentationTitle =
    planResult.sections[0]?.title || planResult.finalTitle;
  const presentation: Omit<Presentation, "userId" | "createdAt" | "updatedAt"> =
    {
      id: nanoid(),
      title: presentationTitle,
      slides: slidesResult.slides,
      themeId: "default",
      isShared: true,
    };

  return {
    presentation,
    sections: planResult.sections,
    slides: slidesResult.slides,
    finalTitle: planResult.finalTitle,
    attachmentText: planResult.attachmentText,
  };
}
