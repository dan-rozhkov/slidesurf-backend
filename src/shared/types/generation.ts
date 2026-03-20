import { Section, Slide, ContentSettings } from "@/types";

export type PlanGenerationParams = {
  title: string;
  slidesCount: number;
  lang: string;
  model: string;
  useResearch?: boolean;
  attachments?: Array<{
    name: string;
    url?: string;
    type: string;
    size: number;
  }>;
};

export type SlidesGenerationParams = {
  prompt: string;
  slidesCount: number;
  slidesPlan?: Section[];
  model?: string;
  contentSettings?: ContentSettings;
  attachments?: Array<{
    name: string;
    url?: string;
    type: string;
    size: number;
  }>;
};

export type FullPresentationGenerationParams = {
  title: string;
  slidesCount?: number;
  lang?: string;
  model?: string;
  attachments?: Array<{
    name: string;
    url?: string;
    type: string;
    size: number;
  }>;
  contentSettings?: ContentSettings;
};

export type PlanGenerationResult = {
  sections: Section[];
  finalTitle: string;
  attachmentText: string;
  researchText?: string;
};

export type SlidesGenerationResult = {
  slides: Slide[];
  attachmentText: string;
};
