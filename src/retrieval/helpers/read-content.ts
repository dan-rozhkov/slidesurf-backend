import { processCSV } from "../processing";
import { processHTML, processTxt, processPdf } from "../processing";
import { getBlobFromS3 } from "./s3";
import mammoth from "mammoth";
import { Attachment } from "@/types";

export async function readContent(attachments: Attachment[]): Promise<string> {
  let attachmentText = "";

  if (attachments && attachments.length > 0) {
    const attachment = attachments[0];
    const attachmentExtension = attachment?.name?.split(".").pop();

    const blob = await getBlobFromS3(
      process.env.AWS_BUCKET_NAME!,
      `attachments/${attachment?.name}`
    );

    switch (attachmentExtension) {
      case "pdf":
        attachmentText = await processPdf(blob);
        break;
      case "docx":
        const arrayBuffer = await blob.arrayBuffer();
        const docx = await mammoth.convertToHtml({
          buffer: Buffer.from(arrayBuffer),
        });
        attachmentText = docx.value;
        break;
      case "csv":
        attachmentText = await processCSV(blob);
        break;
      case "html":
        attachmentText = await processHTML(blob);
        break;
      default:
        attachmentText = await processTxt(blob);
    }
  }

  return attachmentText;
}
