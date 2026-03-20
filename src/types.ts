import { themes } from "@/db/schema/themes-schema";
import type { InferSelectModel } from "drizzle-orm";

export enum SlideLayout {
  WITHOUT = "without",
  TOP_IMAGE = "top-image",
  LEFT_IMAGE = "left-image",
  RIGHT_IMAGE = "right-image",
  TITUL = "titul",
  SECTION_INTRO = "section-intro",
  FINAL = "final",
}

export enum SlideVerticalAlign {
  TOP = "top",
  CENTER = "center",
  BOTTOM = "bottom",
}

export type Slide = {
  id: string;
  title?: string;
  content: string;
  verticalAlign?: SlideVerticalAlign;
  colorAccent?: "light" | "dark";
  backgroundImageUrl?: string;
  layout?: SlideLayout;
  layoutImageUrl?: string;
  isLoadingLayoutImage?: boolean;
  index?: number;
};

export type Presentation = {
  id: string;
  title: string;
  slides: Slide[];
  themeId: string;
  planId?: string | null;
  isDeleted?: boolean;
  isShared?: boolean;
  updatedAt?: Date;
  createdAt?: Date;
};

export enum SlideAction {
  CHANGE_LAYOUT = "change-layout",
  SPELL_CHECK = "spell-check",
  TRANSLATE_TO_RUSSIAN = "translate-to-russian",
  WRITE_MORE_DETAILED = "write-more-detailed",
  SHORTEN_TEXT = "shorten-text",
  SPLIT_INTO_ITEMS = "split-into-items",
  SPLIT_INTO_SECTIONS = "split-into-sections",
  IMPROVE_TEXT = "improve-text",
}

export enum SlidesTemplates {
  EMPTY = "empty",
  TWO_COLS_WITH_SUBHEADINGS = "twoColsWithSubheadings",
  TWO_COLS = "twoCols",
  TWO_COLS_WITH_BAR_CHART = "twoColsWithBarChart",
  THREE_COLS = "threeCols",
  FOUR_COLS = "fourCols",
  CARDS = "cards",
  FRONT_SLIDE = "frontSlide",
  IMAGE_WITH_TEXT = "imageWithText",
  TEXT_WITH_IMAGE = "textWithImage",
  TITLE_WITH_LIST_OPTIONS_AND_IMAGE = "titleWithListOptionsAndImage",
  TITLE_WITH_LIST_OPTIONS = "titleWithListOptions",
  TITLE_WITH_TABLE = "titleWithTable",
  TITLE_WITH_FEATURES_LIST = "titleWithFeaturesList",
  TITLE_WITH_TIMELINE = "titleWithTimeline",
  ARROWS_HORIZONTAL = "arrowsHorizontal",
  PYRAMID = "pyramid",
  STATISTICS = "statistics",
  BIG_NUMBERS = "bigNumbers",
  RATING_STARS = "ratingStars",
  QUOTES = "quotes",
  BENTO_GRID = "bentoGrid",
}

export type Section = {
  id: string;
  index?: number;
  title: string;
  keyPoints?: string[];
};

export type Theme = Pick<
  InferSelectModel<typeof themes>,
  | "id"
  | "name"
  | "previewUrl"
  | "colors"
  | "fontFamily"
  | "fontFamilyHeader"
  | "fontSizes"
  | "fontWeights"
  | "imageMaskUrl"
  | "backgroundImageUrl"
  | "isCorporate"
  | "assets"
  | "isPublic"
>;

export type ThemeColors = {
  background: string;
  foreground: string;
  accent: string;

  card?: {
    background: string;
    foreground: string;
    borderColor?: string;
  };

  table?: {
    borderColor: string;
    rowBackground: string;
    headerBackground: string;
    headerFontColor: string;
  };

  smartLayout?: {
    items: string[];
    statFill: string;
    statEmpty: string;
    borderColor?: string;
  };

  chart?: string[];

  themeLayouts?: {
    [key in SlideLayout]: {
      backgroundImageUrl?: string;
      colors?: {
        foreground?: string;
        accent?: string;
      };
      padding?: {
        top?: string;
        left?: string;
        right?: string;
        bottom?: string;
      };
    };
  };
};

export type ChartType =
  | "bar"
  | "line"
  | "pie"
  | "area"
  | "donut"
  | "h-bar"
  | "radar"
  | "radial-bar"
  | "waterfall";

export type ChartData = {
  name: string;
  values: number[];
  headers: string[];
};

export type Attachment = {
  url?: string;
  name: string;
  size: number;
  type: string;
};

export type Message = {
  role: "user" | "assistant" | "function";
  content: string;
  name?: string;
};

export type FunctionCall = {
  name: string;
  arguments: Record<string, string>;
};

export type SearchResult = {
  domain: string;
  url: string;
  title: string;
  passages: string[];
};

export type SearchResponse = {
  query: string;
  found: number;
  results: SearchResult[];
};

export type ContentSettings = {
  tone?: "formal" | "informal" | "neutral";
  whom?: "all" | "boss" | "colleagues" | "clients";
  contentStyle?: "more" | "less" | "as-is";
};

export type SlidePlaceholder = {
  id: string;
  type: "placeholder";
  afterSlideId?: string;
};

// Noun Project API types
export type NounProjectIcon = {
  id: number | string;
  thumbnail_url: string;
};

export type NounProjectResponse = {
  icons?: NounProjectIcon[];
};

// Team types
export type TeamRole = "owner" | "member";

export type Team = {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamMember = {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
  // Extended fields when joined with user
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
};

export type TeamInvitation = {
  id: string;
  teamId: string;
  email: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
  // Extended fields when joined with team
  team?: Team;
};

export type TeamPresentation = {
  id: string;
  teamId: string;
  presentationId: string;
  sharedBy: string;
  sharedAt: Date;
};

export type TeamWithMembers = Team & {
  members: TeamMember[];
  memberCount: number;
};

export type TeamWithRole = Team & {
  role: TeamRole;
};
