export const processHTML = async (html: Blob): Promise<string> => {
  const fileBuffer = Buffer.from(await html.arrayBuffer());
  const textDecoder = new TextDecoder("utf-8");
  const textContent = textDecoder.decode(fileBuffer);
  return textContent;
};
