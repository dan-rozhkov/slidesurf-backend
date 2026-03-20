import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export const processPdf = async (pdf: Blob): Promise<string> => {
  const loader = new PDFLoader(pdf);
  const docs = await loader.load();
  const completeText = docs.map((doc) => doc.pageContent).join(" ");
  return completeText;
};
