import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { uploadToS3, deleteFromS3 } from "@/retrieval/helpers/s3.js";
import { authHook } from "@/hooks/auth-hook.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function themeAssetRoutes(fastify: FastifyInstance) {
  // POST /api/themes/assets/upload - Upload a theme asset image
  fastify.post(
    "/api/themes/assets/upload",
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ error: "No file provided" });
        }

        const type =
          (data.fields.type as { value: string } | undefined)?.value ?? null;

        if (!type || !["background", "slide"].includes(type)) {
          return reply
            .code(400)
            .send({ error: "Invalid type. Must be 'background' or 'slide'" });
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(data.mimetype)) {
          return reply.code(400).send({
            error: "Invalid file type. Only JPEG, PNG, and WebP are allowed",
          });
        }

        // Convert file to buffer
        const buffer = await data.toBuffer();

        // Validate file size
        if (buffer.length > MAX_FILE_SIZE) {
          return reply
            .code(400)
            .send({ error: "File too large. Maximum size is 10MB" });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2);
        const fileExtension = data.filename.split(".").pop();
        const fileName = `themes/${request.userId}/${type}/${timestamp}-${randomString}.${fileExtension}`;

        // Upload to S3
        const bucketName = process.env.AWS_BUCKET_NAME!;
        const imageUrl = await uploadToS3(
          bucketName,
          fileName,
          buffer,
          data.mimetype
        );

        return reply.send({ imageUrl });
      } catch (error) {
        console.error("Error uploading theme asset:", error);
        return reply.code(500).send({ error: "Failed to upload image" });
      }
    }
  );

  // DELETE /api/themes/assets/delete - Delete a theme asset image
  fastify.delete(
    "/api/themes/assets/delete",
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { url: imageUrl } = request.query as { url?: string };

        if (!imageUrl) {
          return reply.code(400).send({ error: "No image URL provided" });
        }

        // Extract object key from URL
        const bucketName = process.env.AWS_BUCKET_NAME!;
        const endpoint = process.env.AWS_ENDPOINT!;

        // Remove endpoint and bucket name from URL to get the object key
        const urlPattern = new RegExp(
          `${endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${bucketName}/`
        );
        const objectKey = imageUrl.replace(urlPattern, "");

        // Verify that the file belongs to the current user (security check)
        if (!objectKey.startsWith(`themes/${request.userId}/`)) {
          return reply
            .code(403)
            .send({ error: "Unauthorized to delete this file" });
        }

        // Delete from S3
        await deleteFromS3(bucketName, objectKey);

        return reply.send({ success: true });
      } catch (error) {
        console.error("Error deleting theme asset:", error);
        return reply.code(500).send({ error: "Failed to delete image" });
      }
    }
  );
}

export default fp(themeAssetRoutes);
