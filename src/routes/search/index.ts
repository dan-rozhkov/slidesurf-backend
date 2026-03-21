import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { OAuth } from "oauth";
import { authHook } from "@/hooks/auth-hook";
import { translateToEnglish } from "@/utils/translate";
import { uploadToS3 } from "@/retrieval/helpers/s3";
import type { NounProjectIcon, NounProjectResponse } from "@/types";

// ─── Schemas ────────────────────────────────────────────────────────────────

const querySchema = z.object({
  query: z.string(),
});

const yandexGensearchSchema = z.object({
  query: z.string(),
  urls: z.array(z.string()),
});

const nounProjectDownloadSchema = z.object({
  iconId: z.string(),
  color: z
    .string()
    .regex(/^[0-9A-Fa-f]{6}$/, "Color must be a 6-digit hex code"),
  filetype: z.enum(["png", "svg"]).default("svg"),
  size: z.number().min(20).max(1200).default(256),
});

// ─── Noun Project OAuth ─────────────────────────────────────────────────────

const NOUN_PROJECT_KEY = process.env.NOUN_PROJECT_KEY;
const NOUN_PROJECT_SECRET = process.env.NOUN_PROJECT_SECRET;

if (!NOUN_PROJECT_KEY || !NOUN_PROJECT_SECRET) {
  console.warn(
    "Noun Project API credentials not found. Please set NOUN_PROJECT_KEY and NOUN_PROJECT_SECRET environment variables."
  );
}

const oauth = new OAuth(
  "https://api.thenounproject.com",
  "https://api.thenounproject.com",
  NOUN_PROJECT_KEY || "",
  NOUN_PROJECT_SECRET || "",
  "1.0",
  null,
  "HMAC-SHA1"
);

function makeOAuthRequest<T = unknown>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    oauth.get(url, "", "", (error, data) => {
      if (error) {
        reject(error);
      } else if (data) {
        try {
          const parsedData = JSON.parse(data.toString());
          resolve(parsedData);
        } catch (parseError) {
          reject(parseError);
        }
      } else {
        reject(new Error("No data received from API"));
      }
    });
  });
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

export default fp(async (fastify: FastifyInstance) => {
  // POST /api/search/unsplash
  fastify.post<{ Body: z.infer<typeof querySchema> }>(
    "/api/search/unsplash",
    { preHandler: authHook },
    async (req, reply) => {
      const { query } = querySchema.parse(req.body);

      if (!query) {
        return reply.code(400).send({ error: "Query is required" });
      }

      try {
        const translatedQuery = await translateToEnglish(query);

        const response = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
            translatedQuery
          )}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`
        );

        const data: any = await response.json();
        const images = data.results.map(
          (result: {
            id: string;
            urls: { regular: string; thumb: string };
          }) => ({
            id: result.id,
            url: result.urls.regular,
            thumb: result.urls.thumb,
          })
        );

        return reply.send(images);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Error" });
      }
    }
  );

  // POST /api/search/yandex
  fastify.post<{ Body: z.infer<typeof querySchema> }>(
    "/api/search/yandex",
    { preHandler: authHook },
    async (req, reply) => {
      const { query } = querySchema.parse(req.body);

      try {
        const response = await fetch(
          "https://searchapi.api.cloud.yandex.net/v2/web/search",
          {
            method: "POST",
            body: JSON.stringify({
              query: {
                searchType: "SEARCH_TYPE_RU",
                queryText: query,
                familyMode: "FAMILY_MODE_NONE",
                page: "0",
                fixTypoMode: "FIX_TYPO_MODE_ON",
              },
            }),
            headers: {
              Authorization: `Bearer ${process.env.YANDEX_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();
        return reply.send(data);
      } catch (error) {
        console.error("Error searching Yandex:", error);
        return reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  // POST /api/search/yandex-gensearch
  fastify.post<{ Body: z.infer<typeof yandexGensearchSchema> }>(
    "/api/search/yandex-gensearch",
    { preHandler: authHook },
    async (req, reply) => {
      const { query, urls } = yandexGensearchSchema.parse(req.body);

      try {
        const response = await fetch(
          "https://searchapi.api.cloud.yandex.net/v2/gen/search",
          {
            method: "POST",
            body: JSON.stringify({
              messages: [
                {
                  role: "ROLE_USER",
                  content: `Вопрос: ${query}. Проанализируй контент сайтов и верни ответ.`,
                },
              ],
              url: {
                url: urls,
              },
              folderId: process.env.YANDEX_FOLDER_ID,
            }),
            headers: {
              Authorization: `Bearer ${process.env.YANDEX_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();
        return reply.send(data);
      } catch (error) {
        console.error("Error searching Yandex:", error);
        return reply.code(500).send({ error: "Internal Server Error" });
      }
    }
  );

  // POST /api/search/freepik
  fastify.post<{ Body: z.infer<typeof querySchema> }>(
    "/api/search/freepik",
    { preHandler: authHook },
    async (req, reply) => {
      const { query } = querySchema.parse(req.body);

      if (!query) {
        return reply.code(400).send({ error: "Query is required" });
      }

      const translatedQuery = await translateToEnglish(query);

      const queryParams = new URLSearchParams({
        term: translatedQuery,
        page: "1",
        limit: "10",
        "filters[content_type][photo]": "1",
        "filters[license][freemium]": "1",
      });

      try {
        const response = await fetch(
          `https://api.freepik.com/v1/resources?${queryParams.toString()}`,
          {
            headers: {
              "x-freepik-api-key": process.env.FREPIK_API_KEY as string,
            },
          }
        );

        const { data } = (await response.json()) as any;
        const images = data.map(
          (result: {
            id: string;
            image: { source: { url: string } };
          }) => ({
            id: result.id,
            url: result.image.source.url,
            thumb: result.image.source.url,
          })
        );

        return reply.send(images);
      } catch (error) {
        console.error(error);
        return reply.code(500).send({ error: "Error" });
      }
    }
  );

  // POST /api/search/nounproject
  fastify.post<{ Body: z.infer<typeof querySchema> }>(
    "/api/search/nounproject",
    { preHandler: authHook },
    async (req, reply) => {
      const { query } = querySchema.parse(req.body);

      if (!query) {
        return reply.code(400).send({ error: "Query is required" });
      }

      if (!NOUN_PROJECT_KEY || !NOUN_PROJECT_SECRET) {
        return reply
          .code(500)
          .send({ error: "API credentials not configured" });
      }

      try {
        const translatedQuery = await translateToEnglish(query);

        const data = await makeOAuthRequest<NounProjectResponse>(
          `https://api.thenounproject.com/v2/icon?query=${encodeURIComponent(
            translatedQuery
          )}&limit=20&thumbnail_size=200&limit_to_public_domain=1`
        );

        const icons =
          data.icons?.map((icon: NounProjectIcon) => ({
            id: String(icon.id),
            url: icon.thumbnail_url,
            thumb: icon.thumbnail_url,
          })) || [];

        return reply.send(icons);
      } catch (error) {
        console.error("The Noun Project API error:", error);
        return reply.code(500).send({ error: "Error" });
      }
    }
  );

  // POST /api/search/nounproject/download
  fastify.post<{ Body: z.infer<typeof nounProjectDownloadSchema> }>(
    "/api/search/nounproject/download",
    { preHandler: authHook },
    async (req, reply) => {
      const { iconId, color, filetype, size } =
        nounProjectDownloadSchema.parse(req.body);

      if (!NOUN_PROJECT_KEY || !NOUN_PROJECT_SECRET) {
        return reply
          .code(500)
          .send({ error: "API credentials not configured" });
      }

      try {
        const downloadUrl = `https://api.thenounproject.com/v2/icon/${iconId}/download?color=${color}&filetype=${filetype}${
          filetype === "png" ? `&size=${size}` : ""
        }`;

        const data = await makeOAuthRequest<{
          base64_encoded_file?: string;
        }>(downloadUrl);

        if (data.base64_encoded_file) {
          const mimeType =
            filetype === "svg" ? "image/svg+xml" : "image/png";
          const fileExtension = filetype === "svg" ? "svg" : "png";

          const buffer = Buffer.from(data.base64_encoded_file, "base64");

          const filename = `nounproject/${iconId}_${color}_${size}.${fileExtension}`;

          const imageUrl = await uploadToS3(
            process.env.AWS_BUCKET_NAME!,
            filename,
            buffer,
            mimeType
          );

          return reply.send({
            success: true,
            imageUrl,
            iconId,
            color,
            filetype,
            size: filetype === "png" ? size : undefined,
          });
        } else {
          throw new Error("No base64 encoded file received from API");
        }
      } catch (error) {
        console.error("The Noun Project download API error:", error);
        return reply
          .code(500)
          .send({ error: "Error downloading icon" });
      }
    }
  );
});
