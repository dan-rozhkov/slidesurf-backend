import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { authHook } from "@/hooks/auth-hook";
import { getPresentationTeams } from "@/services/teams-service";
import {
  getPresentationsWithTeamShared,
  createEmptyPresentation,
  getPresentationById,
  updatePresentation,
} from "@/services/presentations-service";

async function presentationRoutes(fastify: FastifyInstance) {
  // GET /api/presentations/with-shared — get own + team-shared presentations
  fastify.get(
    "/api/presentations/with-shared",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const presentations = await getPresentationsWithTeamShared(req.userId);
        return reply.send(presentations);
      } catch (error) {
        console.error("Error fetching presentations:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch presentations" });
      }
    }
  );

  // POST /api/presentations/empty — create empty presentation
  fastify.post(
    "/api/presentations/empty",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const presentation = await createEmptyPresentation(req.userId);
        return reply.code(201).send(presentation);
      } catch (error) {
        console.error("Error creating empty presentation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to create presentation" });
      }
    }
  );

  // GET /api/presentations/:id — get presentation by ID
  fastify.get(
    "/api/presentations/:id",
    { onRequest: [authHook] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const presentation = await getPresentationById(
          req.params.id,
          req.userId
        );
        if (!presentation) {
          return reply.code(404).send({ error: "Presentation not found" });
        }
        return reply.send(presentation);
      } catch (error) {
        console.error("Error fetching presentation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch presentation" });
      }
    }
  );

  // PUT /api/presentations/:id — update presentation
  fastify.put(
    "/api/presentations/:id",
    { onRequest: [authHook] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const updated = await updatePresentation(
          req.params.id,
          req.body as any,
          req.userId
        );
        if (!updated) {
          return reply.code(404).send({ error: "Presentation not found" });
        }
        return reply.send(updated);
      } catch (error) {
        console.error("Error updating presentation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to update presentation" });
      }
    }
  );

  // GET /api/presentations/:id/teams — get teams a presentation is shared with (authenticated)
  fastify.get(
    "/api/presentations/:id/teams",
    { onRequest: [authHook] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = req.params;
        const teams = await getPresentationTeams(id, req.userId);

        return reply.send({ teams });
      } catch (error) {
        console.error("Error fetching presentation teams:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch presentation teams" });
      }
    }
  );
}

export default fp(presentationRoutes, {
  name: "presentation-routes",
});
