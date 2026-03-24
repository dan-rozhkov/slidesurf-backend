import fp from "fastify-plugin";
import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "@/auth";
import { fromNodeHeaders } from "better-auth/node";
import { splitCookiesString } from "set-cookie-parser";

async function betterAuthHandler(request: FastifyRequest, reply: FastifyReply) {
  const url = new URL(request.url, `${request.protocol}://${request.hostname}`);

  const headers = new Headers();
  Object.entries(request.headers).forEach(([key, value]) => {
    if (value) headers.append(key, value.toString());
  });

  const req = new Request(url.toString(), {
    method: request.method,
    headers,
    ...(request.body ? { body: JSON.stringify(request.body) } : {}),
  });

  const response = await auth.handler(req);

  reply.status(response.status);
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      // Headers.entries() joins multiple Set-Cookie into one string.
      // Split them so each cookie gets its own header.
      for (const cookie of splitCookiesString(value)) {
        reply.header("set-cookie", cookie);
      }
    } else {
      reply.header(key, value);
    }
  }
  reply.send(response.body ? await response.text() : null);
}

export default fp(async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: betterAuthHandler,
  });

  // GET /api/api-keys — list user's API keys
  fastify.get(
    "/api/api-keys",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const result = await auth.api.listApiKeys({
          headers: fromNodeHeaders(request.headers),
        });
        return reply.send(result);
      } catch (error) {
        console.error("Error listing API keys:", error);
        return reply.code(500).send({ error: "Failed to list API keys" });
      }
    }
  );

  // POST /api/api-keys — create API key
  fastify.post(
    "/api/api-keys",
    async (
      request: FastifyRequest<{ Body: { name: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const result = await auth.api.createApiKey({
          body: request.body as any,
          headers: fromNodeHeaders(request.headers),
        });
        return reply.send(result);
      } catch (error) {
        console.error("Error creating API key:", error);
        return reply.code(500).send({ error: "Failed to create API key" });
      }
    }
  );

  // DELETE /api/api-keys/:id — delete API key
  fastify.delete(
    "/api/api-keys/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const result = await auth.api.deleteApiKey({
          body: { keyId: request.params.id },
          headers: fromNodeHeaders(request.headers),
        });
        return reply.send(result);
      } catch (error) {
        console.error("Error deleting API key:", error);
        return reply.code(500).send({ error: "Failed to delete API key" });
      }
    }
  );
});
