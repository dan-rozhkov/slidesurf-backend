import dedent from "dedent";

export function createTitleGenerationPrompt(title: string, lang: string): string {
  return dedent`
    You are a title generator for presentations.
    Create a concise, descriptive title (max 15 words) for a presentation based on this content:

    ${title}

    The title should be in ${lang} language.
    Return only the title, nothing else.
  `;
}

export function createPlanGenerationPrompt(
  finalTitle: string,
  finalContent: string,
  slidesCount: number,
  lang: string
): string {
  return dedent`
    You are a presentation outline generator.
    You need to create a presentation outline for the following <title> and <content>:

    <title>
    ${finalTitle}
    </title>

    <content>
    ${finalContent}
    </content>

    Generate ${slidesCount} sections for the presentation.
    Each line should contain a complete section title with the following format:

    <format>
      index: <section number starting from 0>
      title: "<section title>"
      keyPoints: "point 1, point 2"
      -----
      index: <section number starting from 0>
      ...
    </format>

    Requirements:
    - Do not wrap the response in \`\`\` tags
    - Separate each section with a line break -----
    - Each section must contain all the required fields
    - Sections should be unique and not repeat
    - Sections should be connected to each other
    - Choose an appropriate title for each section
    - The titles should be concise and to the point
    - The titles should be easy to understand
    - Include the section index (0-based) in each object
    - The titles should be in ${lang} language
    - keyPoints should contain exactly 2 key points separated by comma
    - keyPoints should be concise and relevant to the slide title
    - First section should be a title slide, the title should reflect the content of the presentation
    - Do not use Intro or Conclusion copies in the titles
    - The titles should be written in sentence case (capitalize only the necessary words, not every word)
  `;
}
