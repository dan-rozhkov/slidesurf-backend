import { z } from "zod";
import { getAccessiblePresentation } from "./presentation-access";

export function createGetSlideContentTool(
  userId: string,
  defaultPresentationId?: string,
  defaultSlideId?: string
) {
  return {
    description: "Fetch slide content for the given presentation and slide identifiers.",
    inputSchema: z.object({
      presentationId: z.string().describe("Presentation ID.").optional(),
      slideId: z.string().describe("Slide ID.").optional(),
    }),
    execute: async ({
      presentationId: toolPresentationId,
      slideId: toolSlideId,
    }: {
      presentationId?: string;
      slideId?: string;
    }) => {
      const resolvedPresentationId = toolPresentationId || defaultPresentationId;
      const resolvedSlideId = toolSlideId || defaultSlideId;

      if (!resolvedPresentationId || !resolvedSlideId) {
        return { error: "Missing presentationId or slideId." };
      }

      const presentation = await getAccessiblePresentation(resolvedPresentationId, userId);
      if (!presentation) {
        return { error: "Presentation not found or access denied." };
      }

      const slideData = presentation.slides.find((item) => item.id === resolvedSlideId);
      if (!slideData) {
        return { error: "Slide not found in presentation." };
      }

      return {
        presentationId: resolvedPresentationId,
        slideId: resolvedSlideId,
        content: slideData.content || "",
        title: slideData.title ?? null,
        layout: slideData.layout ?? null,
        verticalAlign: slideData.verticalAlign ?? null,
      };
    },
  };
}
