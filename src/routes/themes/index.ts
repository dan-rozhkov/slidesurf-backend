import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { auth } from "@/auth";
import { authHook } from "@/hooks/auth-hook";
import { ThemesService } from "@/services/themes-service";

export default fp(async (fastify: FastifyInstance) => {
  // GET /api/themes - get available themes (optional auth)
  fastify.get("/api/themes", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers as Record<string, string>,
      });

      const userId = session?.user?.id;
      const themes = await ThemesService.getAvailableThemes(userId);

      return reply.send({ themes });
    } catch (error) {
      console.error("Error fetching themes:", error);
      return reply.code(500).send({ error: "Failed to fetch themes" });
    }
  });

  // POST /api/themes - create a theme (auth required)
  fastify.post(
    "/api/themes",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const themeData = req.body as any;
        const newTheme = await ThemesService.createTheme(themeData, req.userId);

        return reply.code(201).send({ theme: newTheme });
      } catch (error) {
        console.error("Error creating theme:", error);
        return reply.code(500).send({ error: "Failed to create theme" });
      }
    }
  );

  // GET /api/themes/user - get user's themes (auth required)
  fastify.get(
    "/api/themes/user",
    { preHandler: [authHook] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userThemes = await ThemesService.getUserThemes(req.userId);
        return reply.send({ themes: userThemes });
      } catch (error) {
        console.error("Error fetching user themes:", error);
        return reply.code(500).send({ error: "Failed to fetch user themes" });
      }
    }
  );

  // GET /api/themes/:id - get theme by id (optional auth)
  fastify.get<{ Params: { id: string } }>(
    "/api/themes/:id",
    async (req, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: req.headers as Record<string, string>,
        });

        const userId = session?.user?.id;
        const { id } = req.params;

        const theme = await ThemesService.getThemeById(id, userId);

        if (!theme) {
          return reply.code(404).send({ error: "Theme not found" });
        }

        return reply.send({ theme });
      } catch (error) {
        console.error("Error fetching theme:", error);
        return reply.code(500).send({ error: "Failed to fetch theme" });
      }
    }
  );

  // PUT /api/themes/:id - update theme (auth required)
  fastify.put<{ Params: { id: string } }>(
    "/api/themes/:id",
    { preHandler: [authHook] },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const themeData = req.body as any;
        const updatedTheme = await ThemesService.updateTheme(id, themeData, req.userId);

        if (!updatedTheme) {
          return reply.code(404).send({ error: "Theme not found or access denied" });
        }

        return reply.send({ theme: updatedTheme });
      } catch (error) {
        console.error("Error updating theme:", error);
        return reply.code(500).send({ error: "Failed to update theme" });
      }
    }
  );

  // DELETE /api/themes/:id - delete theme (auth required)
  fastify.delete<{ Params: { id: string } }>(
    "/api/themes/:id",
    { preHandler: [authHook] },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const deleted = await ThemesService.deleteTheme(id, req.userId);

        if (!deleted) {
          return reply.code(404).send({ error: "Theme not found or access denied" });
        }

        return reply.send({ success: true });
      } catch (error) {
        console.error("Error deleting theme:", error);
        return reply.code(500).send({ error: "Failed to delete theme" });
      }
    }
  );

  // PUT /api/themes/:id/visibility - set theme visibility (auth required)
  fastify.put<{ Params: { id: string } }>(
    "/api/themes/:id/visibility",
    { preHandler: [authHook] },
    async (req, reply) => {
      try {
        const { isPublic } = req.body as { isPublic: boolean };

        if (typeof isPublic !== "boolean") {
          return reply.code(400).send({ error: "isPublic must be a boolean" });
        }

        const { id } = req.params;
        const updatedTheme = await ThemesService.setThemeVisibility(
          id,
          isPublic,
          req.userId
        );

        if (!updatedTheme) {
          return reply.code(404).send({ error: "Theme not found or access denied" });
        }

        return reply.send({ theme: updatedTheme });
      } catch (error) {
        console.error("Error updating theme visibility:", error);
        return reply.code(500).send({ error: "Failed to update theme visibility" });
      }
    }
  );
});
