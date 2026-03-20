import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.AWS_ENDPOINT,
});

export async function getBlobFromS3(bucketName: string, objectKey: string) {
  const params = {
    Bucket: bucketName,
    Key: objectKey,
  };

  try {
    const response = await s3Client.send(new GetObjectCommand(params));
    const { Body } = response;

    const chunks = [];
    if (!Body) throw new Error("No body in response");

    const stream = Body as unknown as Readable;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const blob = new Blob([buffer], { type: response.ContentType });

    return blob;
  } catch (error) {
    console.error("Error getting blob from S3:", error);
    throw error;
  }
}

export async function uploadToS3(
  bucketName: string,
  objectKey: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const params = {
    Bucket: bucketName,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    return `${process.env.AWS_ENDPOINT}/${bucketName}/${objectKey}`;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

export async function deleteFromS3(
  bucketName: string,
  objectKey: string
): Promise<void> {
  const params = {
    Bucket: bucketName,
    Key: objectKey,
  };

  try {
    await s3Client.send(new DeleteObjectCommand(params));
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
}
