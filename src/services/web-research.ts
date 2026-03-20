import { aiGenerateText } from "./ai-client";

export type ResearchSource = {
  title?: string;
  url?: string;
  snippet?: string;
};

export type WebResearchResult = {
  raw: string;
  summary: string;
  sources: ResearchSource[];
};

const PERPLEXITY_SONAR_MODEL = "perplexity/sonar";

function extractJson(text: string): string | null {
  const trimmed = text.trim().replace(/^```json\s*|\s*```$/g, "");
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}

function parseResearchResponse(text: string): WebResearchResult {
  const jsonText = extractJson(text);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as {
        summary?: string;
        sources?: ResearchSource[];
      };
      return {
        raw: text,
        summary: parsed.summary || text,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      };
    } catch {
      return { raw: text, summary: text, sources: [] };
    }
  }

  return { raw: text, summary: text, sources: [] };
}

export async function runWebResearch(args: {
  title: string;
  lang: string;
}): Promise<WebResearchResult> {
  const { title, lang } = args;
  const languageName = lang === "ru" ? "Russian" : "English";

  const prompt = [
    "You are a web research assistant.",
    `Search the web for the topic: "${title}".`,
    `Respond in ${languageName}.`,
    "Return JSON only with keys: summary, sources.",
    "summary: 4-8 sentences for a presentation outline.",
    "sources: array of 3-7 items with title, url, snippet.",
    "Do not wrap the JSON in markdown or backticks.",
  ].join("\n");

  const response = await aiGenerateText({
    prompt,
    model: PERPLEXITY_SONAR_MODEL,
    temperature: 0.2,
  });

  return parseResearchResponse(response.text || "");
}
