import { aiGenerateText } from "@/services/ai-client";

export async function translateToEnglish(text: string): Promise<string> {
  try {
    const result = await aiGenerateText({
      model: process.env.OPENROUTER_MODEL,
      prompt: `
    Translate the following text to English. If the text is already in English, return it as is.
    Return ONLY the translated text, nothing else.
    Do not wrap the response in \`\`\` tags or quotes.

    Text to translate:
    ${text}
    `,
    });

    return result.text.trim();
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}
