import { Section } from "@/types";
import { nanoid } from "@/utils/nanoid";

export function parseSectionBlock(block: string): Partial<Section> | null {
  const section: Partial<Section> = {};
  const lines = block.trim().split("\n");

  lines.forEach((line) => {
    const [key, value] = line.split(/:\s(.+)/);
    if (key && value) {
      switch (key.trim()) {
        case "title":
          section.title = value.trim().replace(/"/g, "");
          break;
        case "keyPoints":
          section.keyPoints = value
            .trim()
            .replace(/"/g, "")
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
          break;
        case "index":
          section.index = parseInt(value.trim(), 10);
          break;
      }
    }
  });

  return section.index !== undefined ? section : null;
}

export function parseSectionsFromBlocks(
  content: string,
  options?: { includeKeyPoints?: boolean }
): Section[] {
  const sections: Section[] = [];
  const blocks = content.split("-----");

  blocks.forEach((block) => {
    const sectionPartial = parseSectionBlock(block);
    if (sectionPartial && sectionPartial.index !== undefined) {
      sections[sectionPartial.index] = {
        id: nanoid(),
        index: sectionPartial.index,
        title: sectionPartial.title || "",
        ...(options?.includeKeyPoints && {
          keyPoints: sectionPartial.keyPoints || [],
        }),
      };
    }
  });

  return sections.filter(Boolean);
}
