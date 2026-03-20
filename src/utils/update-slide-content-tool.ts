import { z } from "zod";
import { getAccessiblePresentation } from "./presentation-access";

export function createUpdateSlideContentTool(
  userId: string,
  defaultPresentationId?: string,
  defaultSlideId?: string
) {
  return {
    description: "Update the content of a presentation slide and return the updated state.",
    inputSchema: z.object({
      presentationId: z.string().describe("Presentation ID.").optional(),
      slideId: z.string().describe("Slide ID.").optional(),
      content: z.string().describe("New slide content in text/HTML format."),
    }),
    execute: async ({
      presentationId: toolPresentationId,
      slideId: toolSlideId,
      content: newContent,
    }: {
      presentationId?: string;
      slideId?: string;
      content: string;
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

      const slideIndex = presentation.slides.findIndex((item) => item.id === resolvedSlideId);
      if (slideIndex === -1) {
        return { error: "Slide not found in presentation." };
      }

      return {
        presentationId: resolvedPresentationId,
        slideId: resolvedSlideId,
        content: newContent,
        slideIndex,
      };
    },
  };
}
