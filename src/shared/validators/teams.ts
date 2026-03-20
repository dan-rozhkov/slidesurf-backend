import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100, "Team name must be 100 characters or less").optional(),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const sharePresentationSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
});

export const unsharePresentationSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
});

export const removeMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, "New owner ID is required"),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type SharePresentationInput = z.infer<typeof sharePresentationSchema>;
export type UnsharePresentationInput = z.infer<typeof unsharePresentationSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
