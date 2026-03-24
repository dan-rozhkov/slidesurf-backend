import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  session as sessionTable,
  user as userTable,
} from "@/db/schema/auth-schema";
import { eq, and, gt } from "drizzle-orm";

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

async function getSessionFromBearer(token: string) {
  const [row] = await db
    .select({ session: sessionTable, user: userTable })
    .from(sessionTable)
    .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(
      and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, new Date()))
    )
    .limit(1);
  return row ?? null;
}

/**
 * Resolve session from cookies or Bearer token.
 * Returns null if no valid session found.
 */
export async function resolveSession(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  });
  if (session) return session;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return getSessionFromBearer(authHeader.slice(7));
  }
  return null;
}

export async function authHook(request: FastifyRequest, reply: FastifyReply) {
  const session = await resolveSession(request);

  if (!session) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  request.userId = session.user.id;
  request.session = session as FastifyRequest["session"];
}
