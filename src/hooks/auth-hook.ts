import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "@/auth";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    session: {
      session: {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
      };
      user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
        role?: string | null;
      };
    };
  }
}

export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  });

  if (!session) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  request.userId = session.user.id;
  request.session = session as FastifyRequest["session"];
}
