import dedent from "dedent";
import { SLIDE_TEMPLATES_FOR_GENERATION } from "@/templates/new-slide-templates";
import { Section, ContentSettings } from "@/types";
import { format } from "date-fns";

export function createSlidesPlanPrompt(slidesPlan: Section[]): string {
  if (!slidesPlan || slidesPlan.length === 0) {
    return "";
  }

  const slidesPlanString = slidesPlan
    .map(
      (slide) => `
      <slide>
      <title>${slide.title}</title>
      ${slide.keyPoints && slide.keyPoints.length > 0
          ? `<keyPoints>
      ${slide.keyPoints.map((point) => `<point>${point}</point>`).join("\n")}
      </keyPoints>`
          : ""
        }
      </slide>
      `
    )
    .join("\n");

  return `The presentation should consist of the following slides, in the order specified: ${slidesPlanString}`;
}

export function createSlidesGenerationPrompt(
  prompt: string,
  attachmentText: string,
  slidesCount: number,
  slidesPlanPrompt: string,
  contentSettings: ContentSettings
): string {
  return dedent`
    You are a presentation designer. Today is ${format(new Date(), "yyyy-MM-dd")}.
    You need to create a presentation for the following <prompt> and <content>:

    <prompt>
    ${prompt}
    </prompt>

    <content>
    ${attachmentText}
    </content>

    Generate ${slidesCount} slides for the presentation.
    ${slidesPlanPrompt &&
    `
    ${slidesPlanPrompt}
    `
    }
    Each line should contain a complete slide object with the following format:

    <format>
      index: <slide number starting from 0>
      layout: "without" | "top-image" | "left-image" | "right-image"
      verticalAlign: "center" | "bottom"
      content: <slide content using the following templates content>
      isLoadingLayoutImage: true
      -----
      index: <slide number starting from 0>
      ...
    </format>


    The slide content must be represented in one of the following templates:

    <content-templates>
      ${SLIDE_TEMPLATES_FOR_GENERATION.map(
      (template) => `
      <template>
        <name>${template.name}</name>
        <description>${template.description}</description>
        <layout>${template.layout}</layout>
        <content>${template.content}</content>
      </template>
      `
    ).join("\n")}
    </content-templates>

    Requirements:
    - Do not wrap the response in \`\`\` tags
    - Separate each slide with a line break -----
    - The presentation should be in the same language as the prompt
    - Each slide MUST contain all the required fields
    - Slides should be unique and not repeat
    - Slides should be connected to each other
    - ALWAYS use EXACTLY the layout that is specified in the content-template
    - Each slide MUST contain text
    - The text should be concise and to the point
    - The text should be easy to understand
    - Include the slide index (0-based) in each object
    - Do not escape quotes in html classes
    - Use single quotes for html attributes and classes
    - All slides MUST be used different slide templates
    - Slide content must contain all elements from the choosen slide template
    - Do not return single quotes in the response
    - First slide must be frontSlide template
    - Every slide MUST use different slide templates
    - Every slide MUST have a content
    - Use verticalAlign: "center" more often
    - Use ONLY provided variants of the layout, do not invent new ones
    - Highlight any names or titles with double quotes
    - All data attributes must be filled in the response
    - <div data-type="feature"> MUST be filled with data-title and data-content
    - <div data-type="timeline-item"> MUST be filled with data-title and data-content
    - You can use inline icons: <span data-type="icon" data-icon-name="ICON_NAME" data-icon-size="SIZE"></span>
    - Icon names are from Lucide icons library (kebab-case), e.g.: rocket, target, trophy, lightbulb, shield, zap, users, globe, lock, clock, bar-chart, settings, code, layers, cpu, database, cloud, heart, star, check-circle, trending-up, award, briefcase, compass, eye, gift, palette
    - Icon sizes: "sm", "md", "lg", "xl". Use "xl" for standalone decorative icons in cards/columns, "md" for inline with text
    - Use icons in cards and column layouts to make slides more visually appealing
    - Each icon in a group (e.g. 3 cards) MUST have a DIFFERENT icon name relevant to the content
    - Content tone should be ${contentSettings?.tone || "neutral"}
    - Content should be addressed to ${contentSettings?.whom || "all"}
    - Content style will be ${contentSettings?.contentStyle || "less"}
    `;
}
