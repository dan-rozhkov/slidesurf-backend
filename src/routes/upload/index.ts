import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { authHook } from "@/hooks/auth-hook.js";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.AWS_ENDPOINT,
});

const IMAGE_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const ATTACHMENT_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "text/html",
];

const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024; // 2MB

async function uploadRoutes(fastify: FastifyInstance) {
  // POST /api/upload - Upload image for a presentation
  fastify.post(
    "/api/upload",
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ error: "File is required" });
        }

        const presentationId =
          (data.fields.presentationId as { value: string } | undefined)
            ?.value ?? null;

        if (!presentationId) {
          return reply
            .code(400)
            .send({ error: "Presentation ID is required" });
        }

        if (!IMAGE_FILE_TYPES.includes(data.mimetype)) {
          return reply.code(400).send({ error: "Invalid file type" });
        }

        const buffer = await data.toBuffer();
        const filename = `${presentationId}/${data.filename}`;

        const params = {
          Bucket: process.env.AWS_BUCKET_NAME!,
          Key: filename,
          Body: buffer,
          ContentType: data.mimetype,
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        return reply.send({
          success: true,
          url: `${process.env.AWS_ENDPOINT}/${process.env.AWS_BUCKET_NAME}/${filename}`,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        return reply.code(500).send({ error: "Error uploading file" });
      }
    }
  );

  // POST /api/attachment/add - Upload attachment file
  fastify.post(
    "/api/attachment/add",
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ error: "File is required" });
        }

        const buffer = await data.toBuffer();

        if (buffer.length > MAX_ATTACHMENT_SIZE) {
          return reply
            .code(400)
            .send({ error: "File size exceeds 2MB limit" });
        }

        if (!ATTACHMENT_FILE_TYPES.includes(data.mimetype)) {
          return reply.code(400).send({ error: "Invalid file type" });
        }

        const filename = `attachments/${data.filename}`;

        const params = {
          Bucket: process.env.AWS_BUCKET_NAME!,
          Key: filename,
          Body: buffer,
          ContentType: data.mimetype,
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        return reply.send({
          url: `${process.env.AWS_ENDPOINT}/${process.env.AWS_BUCKET_NAME}/${filename}`,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        return reply.code(500).send({ error: "Error uploading file" });
      }
    }
  );
}

export default fp(uploadRoutes);
