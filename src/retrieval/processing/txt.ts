export const processTxt = async (txt: Blob): Promise<string> => {
  const fileBuffer = Buffer.from(await txt.arrayBuffer());
  const textDecoder = new TextDecoder("utf-8");
  const textContent = textDecoder.decode(fileBuffer);
  return textContent;
};
