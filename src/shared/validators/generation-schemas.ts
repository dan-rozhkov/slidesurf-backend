import { z } from "zod";
import { ContentSettings } from "@/types";

export const contentSettingsSchema = z.object({
  tone: z.enum(["formal", "informal", "neutral"]).optional(),
  whom: z.enum(["all", "boss", "colleagues", "clients"]).optional(),
  contentStyle: z.enum(["more", "less", "as-is"]).optional(),
}) satisfies z.ZodType<ContentSettings>;

export const attachmentSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  type: z.string(),
  size: z.number(),
});

export const planGenerationSchema = z.object({
  title: z.string(),
  slidesCount: z.number().min(-1).max(60).optional(),
  lang: z.enum(["ru", "en"]),
  model: z.string(),
  useResearch: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

export const slidesGenerationSchema = z.object({
  prompt: z.string(),
  slidesCount: z.number().min(-1).max(60).optional(),
  slidesPlan: z
    .array(
      z.object({
        title: z.string(),
        id: z.string(),
        index: z.number().optional(),
      })
    )
    .optional(),
  model: z.string().optional(),
  contentSettings: contentSettingsSchema.optional(),
  attachments: z.array(attachmentSchema).optional(),
});

export const fullPresentationGenerationSchema = z.object({
  title: z.string(),
  slidesCount: z.number().min(-1).max(60).optional(),
  lang: z.enum(["ru", "en"]).optional(),
  attachments: z.array(attachmentSchema).optional(),
  contentSettings: contentSettingsSchema.optional(),
});
