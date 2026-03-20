import { db } from "./index";
import { aiModels } from "./schema/ai-models-schema";

const textModels = [
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", description: "Google's advanced multimodal model", provider: "Google", isAdvanced: false },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Google's advanced multimodal model", provider: "Google", isAdvanced: false },
  { id: "x-ai/grok-4.1-fast", name: "Grok 4.1 Fast", description: "Grok 4.1's advanced multimodal model", provider: "X-AI", isAdvanced: false },
  { id: "qwen/qwen3-next-80b-a3b-instruct", name: "Qwen 3 Next 80B A3B Instruct", description: "Qwen's advanced multimodal model", provider: "Qwen", isAdvanced: false },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Fast and cost-effective GPT-4o variant", provider: "OpenAI", isAdvanced: false },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", description: "Fast and efficient Claude model", provider: "Anthropic", isAdvanced: false },
  { id: "minimax/minimax-m2", name: "MiniMax M2", description: "MiniMax's advanced multimodal model", provider: "MiniMax", isAdvanced: false },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", description: "DeepSeek's advanced multimodal model", provider: "DeepSeek", isAdvanced: false },
  { id: "z-ai/glm-4.6", name: "GLM 4.6", description: "Z-AI's advanced multimodal model", provider: "Z-AI", isAdvanced: false },
  { id: "moonshotai/kimi-k2-0905", name: "MoonshotAI Kimi K2", description: "MoonshotAI's most intelligent model", provider: "MoonshotAI", isAdvanced: false },
  { id: "moonshotai/kimi-k2-thinking", name: "MoonshotAI Kimi K2 Thinking", description: "MoonshotAI's most intelligent model with thinking capabilities", provider: "MoonshotAI", isAdvanced: false },
  { id: "openai/gpt-5.2", name: "GPT-5.2", description: "OpenAI's most intelligent model", provider: "OpenAI", isAdvanced: true },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Anthropic's most intelligent model", provider: "Anthropic", isAdvanced: true },
  { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5", description: "Anthropic's most intelligent model", provider: "Anthropic", isAdvanced: true },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro Preview", description: "Google's advanced multimodal model", provider: "Google", isAdvanced: true },
];

const imageModels = [
  { id: "fal-ai/flux-1/schnell", name: "Flux Schnell", description: "Black Forest Labs' advanced image generation model", provider: "Black Forest Labs", isAdvanced: false },
  { id: "fal-ai/flux-2/klein/4b", name: "Flux Klein 4B", description: "Flux Klein 4B's advanced image generation model", provider: "Black Forest Labs", isAdvanced: false },
  { id: "fal-ai/z-image/turbo", name: "Image Turbo", description: "Z-AI's advanced image generation model", provider: "Z-AI", isAdvanced: false },
  { id: "fal-ai/luma-photon/flash", name: "Photon Flash", description: "Luma's advanced image generation model", provider: "Luma", isAdvanced: false },
  { id: "fal-ai/flux-2-pro", name: "Flux 2 Pro", description: "Flux 2 Pro's advanced image generation model", provider: "Black Forest Labs", isAdvanced: false },
  { id: "fal-ai/nano-banana", name: "Nano Banana", description: "Nano Banana's advanced image generation model", provider: "Google", isAdvanced: false },
  { id: "fal-ai/imagen4/preview/fast", name: "Imagen 4 Fast", description: "Google's advanced image generation model", provider: "Google", isAdvanced: true },
  { id: "fal-ai/nano-banana-pro", name: "Nano Banana Pro", description: "Google's advanced image generation model", provider: "Google", isAdvanced: true },
  { id: "fal-ai/gpt-image-1.5", name: "Image 1.5", description: "GPT's advanced image generation model", provider: "GPT", isAdvanced: true },
  { id: "fal-ai/flux-2-max", name: "Flux 2 Max", description: "Flux 2 Max's advanced image generation model", provider: "Black Forest Labs", isAdvanced: true },
];

async function seed() {
  console.log("Seeding ai_models...");

  const allModels = [
    ...textModels.map((m, i) => ({ ...m, type: "text" as const, sortOrder: i })),
    ...imageModels.map((m, i) => ({ ...m, type: "image" as const, sortOrder: i })),
  ];

  await db
    .insert(aiModels)
    .values(allModels)
    .onConflictDoNothing();

  console.log(`Seeded ${allModels.length} ai_models.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
