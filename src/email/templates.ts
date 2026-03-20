export const getPasswordResetEmailTemplate = (
  userName: string,
  resetUrl: string
) => ({
  subject: "Reset your password",
  text: `Hello ${userName},\n\nYou requested a password reset for your account.\n\nClick the following link to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this reset, please ignore this email.`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>Hello ${userName},</p>
      <p>You requested a password reset for your account.</p>
      <p>Click the following button to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p><strong>This link will expire in 1 hour.</strong></p>
      <p>If you didn't request this reset, please ignore this email.</p>
    </div>
  `,
});

export const getTeamInvitationEmailTemplate = (
  teamName: string,
  inviterName: string,
  invitationUrl: string,
  expiryDays: number
) => ({
  subject: `You've been invited to join "${teamName}"`,
  text: `Hello,\n\n${inviterName} has invited you to join the team "${teamName}" on Slidee.\n\nClick the following link to accept the invitation:\n${invitationUrl}\n\nThis invitation will expire in ${expiryDays} days.\n\nIf you didn't expect this invitation, you can ignore this email.`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Team Invitation</h2>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to join the team <strong>"${teamName}"</strong> on Slidee.</p>
      <p>Click the button below to accept the invitation:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666;">${invitationUrl}</p>
      <p><strong>This invitation will expire in ${expiryDays} days.</strong></p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  `,
});
