import { Section } from "@/types";
import {
  parseSectionBlock,
  parseSectionsFromBlocks,
} from "@/shared/section-parser";

export { parseSectionBlock };

export function parseSectionsFromResponse(content: string): Section[] {
  return parseSectionsFromBlocks(content, { includeKeyPoints: true });
}
