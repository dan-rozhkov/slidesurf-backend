import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { authHook } from "@/hooks/auth-hook";
import { getPresentationTeams } from "@/services/teams-service";
import {
  getPresentationsWithTeamShared,
  getSharedWithMePresentations,
  createPresentation,
  createEmptyPresentation,
  getPresentationById,
  updatePresentation,
  getDeletedPresentations,
  toTrash,
  restorePresentation,
  deletePresentation,
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

  // GET /api/presentations/shared-with-me — get presentations shared with user via teams
  fastify.get(
    "/api/presentations/shared-with-me",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const presentations = await getSharedWithMePresentations(req.userId);
        return reply.send(presentations);
      } catch (error) {
        console.error("Error fetching shared presentations:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch shared presentations" });
      }
    }
  );

  // POST /api/presentations — create presentation with slides data
  fastify.post(
    "/api/presentations",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = req.body as any;
        const presentation = await createPresentation(body, req.userId);
        return reply.code(201).send(presentation);
      } catch (error) {
        console.error("Error creating presentation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to create presentation" });
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

  // GET /api/presentations/deleted — get deleted presentations
  fastify.get(
    "/api/presentations/deleted",
    { onRequest: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const deleted = await getDeletedPresentations(req.userId);
        return reply.send(deleted);
      } catch (error) {
        console.error("Error fetching deleted presentations:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch deleted presentations" });
      }
    }
  );

  // POST /api/presentations/:id/trash — move presentation to trash
  fastify.post(
    "/api/presentations/:id/trash",
    { onRequest: [authHook] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        await toTrash(req.params.id, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error moving presentation to trash:", error);
        return reply
          .code(500)
          .send({ error: "Failed to move presentation to trash" });
      }
    }
  );

  // POST /api/presentations/:id/restore — restore presentation from trash
  fastify.post(
    "/api/presentations/:id/restore",
    { onRequest: [authHook] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        await restorePresentation(req.params.id, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error restoring presentation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to restore presentation" });
      }
    }
  );

  // DELETE /api/presentations/:id — permanently delete presentation
  fastify.delete(
    "/api/presentations/:id",
    { onRequest: [authHook] },
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        await deletePresentation(req.params.id, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error deleting presentation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to delete presentation" });
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
