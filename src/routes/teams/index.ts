import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { authHook } from "@/hooks/auth-hook";
import {
  getUserTeams,
  createTeam,
  getTeamById,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  inviteMember,
  removeMember,
  getTeamInvitations,
  cancelInvitation,
  leaveTeam,
  transferOwnership,
  getTeamSharedPresentations,
  sharePresentationWithTeam,
  unsharePresentationFromTeam,
  getInvitationByToken,
  acceptInvitation,
} from "@/services/teams-service";
import {
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
  removeMemberSchema,
  transferOwnershipSchema,
  sharePresentationSchema,
  unsharePresentationSchema,
} from "@/shared/validators/teams";

const cancelInvitationSchema = z.object({
  invitationId: z.string().min(1, "Invitation ID is required"),
});

async function teamsRoutes(fastify: FastifyInstance) {
  // GET /api/teams - List user's teams
  fastify.get(
    "/api/teams",
    { onRequest: authHook },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const teams = await getUserTeams(req.userId);
        return reply.send({ teams });
      } catch (error) {
        console.error("Error fetching teams:", error);
        return reply.code(500).send({ error: "Failed to fetch teams" });
      }
    }
  );

  // POST /api/teams - Create a team
  fastify.post(
    "/api/teams",
    { onRequest: authHook },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { name, description } = createTeamSchema.parse(req.body);
        const team = await createTeam(req.userId, name, description);
        return reply.code(201).send({ team });
      } catch (error) {
        console.error("Error creating team:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply.code(500).send({ error: "Failed to create team" });
      }
    }
  );

  // GET /api/teams/:id - Get team by ID
  fastify.get<{ Params: { id: string } }>(
    "/api/teams/:id",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const team = await getTeamById(id, req.userId);

        if (!team) {
          return reply.code(404).send({ error: "Team not found" });
        }

        return reply.send({ team });
      } catch (error) {
        console.error("Error fetching team:", error);
        return reply.code(500).send({ error: "Failed to fetch team" });
      }
    }
  );

  // PUT /api/teams/:id - Update team
  fastify.put<{ Params: { id: string } }>(
    "/api/teams/:id",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const data = updateTeamSchema.parse(req.body);
        const team = await updateTeam(id, req.userId, data);
        return reply.send({ team });
      } catch (error) {
        console.error("Error updating team:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply.code(500).send({ error: "Failed to update team" });
      }
    }
  );

  // DELETE /api/teams/:id - Delete team
  fastify.delete<{ Params: { id: string } }>(
    "/api/teams/:id",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        await deleteTeam(id, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error deleting team:", error);

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply.code(500).send({ error: "Failed to delete team" });
      }
    }
  );

  // GET /api/teams/:id/members - Get team members
  fastify.get<{ Params: { id: string } }>(
    "/api/teams/:id/members",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const members = await getTeamMembers(id, req.userId);
        return reply.send({ members });
      } catch (error) {
        console.error("Error fetching team members:", error);

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to fetch team members" });
      }
    }
  );

  // POST /api/teams/:id/members - Invite a member
  fastify.post<{ Params: { id: string } }>(
    "/api/teams/:id/members",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { email } = inviteMemberSchema.parse(req.body);
        const invitation = await inviteMember(
          id,
          req.userId,
          req.session.user.email,
          req.session.user.name,
          email
        );
        return reply.code(201).send({ invitation });
      } catch (error) {
        console.error("Error inviting member:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply.code(500).send({ error: "Failed to invite member" });
      }
    }
  );

  // DELETE /api/teams/:id/members - Remove a member
  fastify.delete<{ Params: { id: string } }>(
    "/api/teams/:id/members",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { userId } = removeMemberSchema.parse(req.body);
        await removeMember(id, req.userId, userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error removing member:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply.code(500).send({ error: "Failed to remove member" });
      }
    }
  );

  // GET /api/teams/:id/invitations - Get team invitations
  fastify.get<{ Params: { id: string } }>(
    "/api/teams/:id/invitations",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const invitations = await getTeamInvitations(id, req.userId);
        return reply.send({ invitations });
      } catch (error) {
        console.error("Error fetching team invitations:", error);

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to fetch team invitations" });
      }
    }
  );

  // DELETE /api/teams/:id/invitations - Cancel an invitation
  fastify.delete<{ Params: { id: string } }>(
    "/api/teams/:id/invitations",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { invitationId } = cancelInvitationSchema.parse(req.body);
        await cancelInvitation(invitationId, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error cancelling invitation:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to cancel invitation" });
      }
    }
  );

  // POST /api/teams/:id/leave - Leave a team
  fastify.post<{ Params: { id: string } }>(
    "/api/teams/:id/leave",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        await leaveTeam(id, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error leaving team:", error);

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply.code(500).send({ error: "Failed to leave team" });
      }
    }
  );

  // POST /api/teams/:id/transfer-ownership - Transfer team ownership
  fastify.post<{ Params: { id: string } }>(
    "/api/teams/:id/transfer-ownership",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { newOwnerId } = transferOwnershipSchema.parse(req.body);
        await transferOwnership(id, req.userId, newOwnerId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error transferring ownership:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to transfer ownership" });
      }
    }
  );

  // GET /api/teams/:id/presentations - Get team shared presentations
  fastify.get<{ Params: { id: string } }>(
    "/api/teams/:id/presentations",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const presentations = await getTeamSharedPresentations(id, req.userId);
        return reply.send({ presentations });
      } catch (error) {
        console.error("Error fetching team presentations:", error);

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to fetch team presentations" });
      }
    }
  );

  // POST /api/teams/:id/presentations - Share a presentation with team
  fastify.post<{ Params: { id: string } }>(
    "/api/teams/:id/presentations",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { presentationId } = sharePresentationSchema.parse(req.body);
        await sharePresentationWithTeam(presentationId, id, req.userId);
        return reply.code(201).send({ success: true });
      } catch (error) {
        console.error("Error sharing presentation:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to share presentation" });
      }
    }
  );

  // DELETE /api/teams/:id/presentations - Unshare a presentation from team
  fastify.delete<{ Params: { id: string } }>(
    "/api/teams/:id/presentations",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { id } = req.params;
        const { presentationId } = unsharePresentationSchema.parse(req.body);
        await unsharePresentationFromTeam(presentationId, id, req.userId);
        return reply.send({ success: true });
      } catch (error) {
        console.error("Error unsharing presentation:", error);

        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: error.errors[0].message });
        }

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to unshare presentation" });
      }
    }
  );

  // GET /api/teams/invitations/:token - Get invitation by token (no auth required)
  fastify.get<{ Params: { token: string } }>(
    "/api/teams/invitations/:token",
    async (req, reply) => {
      try {
        const { token } = req.params;
        const invitation = await getInvitationByToken(token);

        if (!invitation) {
          return reply.code(404).send({ error: "Invitation not found" });
        }

        return reply.send({ invitation });
      } catch (error) {
        console.error("Error fetching invitation:", error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch invitation" });
      }
    }
  );

  // POST /api/teams/invitations/:token - Accept an invitation
  fastify.post<{ Params: { token: string } }>(
    "/api/teams/invitations/:token",
    { onRequest: authHook },
    async (req, reply) => {
      try {
        const { token } = req.params;
        const team = await acceptInvitation(
          token,
          req.userId,
          req.session.user.email
        );
        return reply.send({ team, success: true });
      } catch (error) {
        console.error("Error accepting invitation:", error);

        if (error instanceof Error) {
          return reply.code(400).send({ error: error.message });
        }

        return reply
          .code(500)
          .send({ error: "Failed to accept invitation" });
      }
    }
  );
}

export default fp(teamsRoutes);
