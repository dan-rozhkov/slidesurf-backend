import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string().url(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // OpenRouter
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_BASE_URL: z
    .string()
    .default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  OPENROUTER_MODEL_STRONG: z.string().optional(),
  OPENROUTER_REFERER: z.string().optional(),
  OPENROUTER_TITLE: z.string().optional(),

  // FAL AI
  FAL_API_KEY: z.string().optional(),

  // AWS S3
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_ENDPOINT: z.string(),
  AWS_BUCKET_NAME: z.string(),

  // YouKassa
  YOUKASSA_SHOP_ID: z.string().optional(),
  YOUKASSA_SECRET_KEY: z.string().optional(),

  // SMTP
  EMAIL_LOGIN: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Search APIs
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  FREEPIK_API_KEY: z.string().optional(),
  NOUN_PROJECT_KEY: z.string().optional(),
  NOUN_PROJECT_SECRET: z.string().optional(),
  YANDEX_API_KEY: z.string().optional(),

  // Pricing
  PLUS_PRICE: z.coerce.number().optional(),
  PRO_PRICE: z.coerce.number().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
