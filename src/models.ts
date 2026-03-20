export type AIModel = {
  id: string;
  name: string;
  description: string;
  provider: string;
  advanced?: boolean;
};

export const AVAILABLE_IMAGE_MODELS: AIModel[] = [
  {
    id: "fal-ai/flux-1/schnell",
    name: "Flux Schnell",
    description: "Black Forest Labs' advanced image generation model",
    provider: "Black Forest Labs",
    advanced: false,
  },
  {
    id: "fal-ai/flux-2/klein/4b",
    name: "Flux Klein 4B",
    description: "Flux Klein 4B's advanced image generation model",
    provider: "Black Forest Labs",
    advanced: false,
  },
  {
    id: "fal-ai/z-image/turbo",
    name: "Image Turbo",
    description: "Z-AI's advanced image generation model",
    provider: "Z-AI",
    advanced: false,
  },
  {
    id: "fal-ai/luma-photon/flash",
    name: "Photon Flash",
    description: "Luma's advanced image generation model",
    provider: "Luma",
    advanced: false,
  },
  {
    id: "fal-ai/flux-2-pro",
    name: "Flux 2 Pro",
    description: "Flux 2 Pro's advanced image generation model",
    provider: "Black Forest Labs",
    advanced: false,
  },
  {
    id: "fal-ai/nano-banana",
    name: "Nano Banana",
    description: "Nano Banana's advanced image generation model",
    provider: "Google",
    advanced: false,
  },
  {
    id: "fal-ai/imagen4/preview/fast",
    name: "Imagen 4 Fast",
    description: "Google's advanced image generation model",
    provider: "Google",
    advanced: true,
  },
  {
    id: "fal-ai/nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Google's advanced image generation model",
    provider: "Google",
    advanced: true,
  },
  {
    id: "fal-ai/gpt-image-1.5",
    name: "Image 1.5",
    description: "GPT's advanced image generation model",
    provider: "GPT",
    advanced: true,
  },
  {
    id: "fal-ai/flux-2-max",
    name: "Flux 2 Max",
    description: "Flux 2 Max's advanced image generation model",
    provider: "Black Forest Labs",
    advanced: true,
  },
];

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    description: "Google's advanced multimodal model",
    provider: "Google",
    advanced: false,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Google's advanced multimodal model",
    provider: "Google",
    advanced: false,
  },
  {
    id: "x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    description: "Grok 4.1's advanced multimodal model",
    provider: "X-AI",
    advanced: false,
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct",
    name: "Qwen 3 Next 80B A3B Instruct",
    description: "Qwen's advanced multimodal model",
    provider: "Qwen",
    advanced: false,
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    description: "Fast and cost-effective GPT-4o variant",
    provider: "OpenAI",
    advanced: false,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    description: "Fast and efficient Claude model",
    provider: "Anthropic",
    advanced: false,
  },
  {
    id: "minimax/minimax-m2",
    name: "MiniMax M2",
    description: "MiniMax's advanced multimodal model",
    provider: "MiniMax",
    advanced: false,
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    description: "DeepSeek's advanced multimodal model",
    provider: "DeepSeek",
    advanced: false,
  },
  {
    id: "z-ai/glm-4.6",
    name: "GLM 4.6",
    description: "Z-AI's advanced multimodal model",
    provider: "Z-AI",
    advanced: false,
  },
  {
    id: "moonshotai/kimi-k2-0905",
    name: "MoonshotAI Kimi K2",
    description: "MoonshotAI's most intelligent model",
    provider: "MoonshotAI",
    advanced: false,
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "MoonshotAI Kimi K2 Thinking",
    description:
      "MoonshotAI's most intelligent model with thinking capabilities",
    provider: "MoonshotAI",
    advanced: false,
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    description: "OpenAI's most intelligent model",
    provider: "OpenAI",
    advanced: true,
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    description: "Anthropic's most intelligent model",
    provider: "Anthropic",
    advanced: true,
  },
  {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    description: "Anthropic's most intelligent model",
    provider: "Anthropic",
    advanced: true,
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    description: "Google's advanced multimodal model",
    provider: "Google",
    advanced: true,
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;
export const DEFAULT_IMAGE_MODEL = AVAILABLE_IMAGE_MODELS[0].id;

/**
 * Get model by ID
 */
export function getModelById(id: string): AIModel | undefined {
  return [...AVAILABLE_MODELS, ...AVAILABLE_IMAGE_MODELS].find(
    (model) => model.id === id
  );
}

/**
 * Check if model is advanced
 */
export function isAdvancedModel(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.advanced === true;
}

/**
 * Get available models for subscription plan
 */
export function getAvailableModelsForPlan(
  canUseAdvancedModels: boolean
): AIModel[] {
  if (canUseAdvancedModels) {
    return AVAILABLE_MODELS;
  }
  return AVAILABLE_MODELS.filter((model) => !model.advanced);
}

/**
 * Get available image models for subscription plan
 */
export function getAvailableImageModelsForPlan(
  canUseAdvancedModels: boolean
): AIModel[] {
  if (canUseAdvancedModels) {
    return AVAILABLE_IMAGE_MODELS;
  }
  return AVAILABLE_IMAGE_MODELS.filter((model) => !model.advanced);
}
