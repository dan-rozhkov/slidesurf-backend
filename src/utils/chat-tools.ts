import { createGetSlideContentTool } from "./get-slide-content-tool";
import { createUpdateSlideContentTool } from "./update-slide-content-tool";
import { createWebSearchTool } from "./web-search-tool";

export function createChatTools(
  userId: string,
  presentationId?: string,
  slideId?: string
) {
  return {
    getSlideContent: createGetSlideContentTool(userId, presentationId, slideId),
    updateSlideContent: createUpdateSlideContentTool(userId, presentationId, slideId),
    webSearch: createWebSearchTool(),
  };
}
