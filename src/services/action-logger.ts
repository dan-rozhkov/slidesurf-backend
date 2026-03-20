import { db, userActionLogs } from "@/db";
import { nanoid } from "nanoid";

export type ActionType =
  | "generate_plan"
  | "generate_slides"
  | "generate_image"
  | "generate_chart"
  | "generate_content"
  | "generate_slide"
  | "generate_selected_text"
  | "export_pptx"
  | "chat"
  | "upload_image"
  | "presentation_feedback";
export type ActionStatus = "success" | "error";

export type LogActionParams = {
  userId: string;
  actionType: ActionType;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  status: ActionStatus;
  errorMessage?: string;
};

export async function logUserAction(params: LogActionParams): Promise<void> {
  const { userId, actionType, metadata, status, errorMessage } = params;

  setImmediate(async () => {
    try {
      await db.insert(userActionLogs).values({
        id: nanoid(),
        userId,
        actionType,
        timestamp: new Date(),
        metadata: metadata || null,
        status,
        errorMessage: errorMessage || null,
      });
    } catch (error) {
      console.error("Failed to log user action:", error);
    }
  });
}
