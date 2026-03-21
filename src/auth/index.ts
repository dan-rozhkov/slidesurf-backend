import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, apiKey, admin } from "better-auth/plugins";
import { db } from "@/db";
import {
  user,
  session,
  account,
  verification,
  apikey,
} from "@/db/schema/auth-schema";
import { sendEmail } from "@/email";
import { getPasswordResetEmailTemplate } from "@/email/templates";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      apikey,
    },
  }),
  trustedOrigins: [process.env.FRONTEND_URL!],
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string; name?: string };
      url: string;
    }) => {
      try {
        const emailTemplate = getPasswordResetEmailTemplate(
          user.name || user.email,
          url
        );

        await sendEmail({
          to: user.email,
          ...emailTemplate,
        });
        console.log(`Password reset email sent to ${user.email}`);
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new Error("Failed to send password reset email");
      }
    },
    onPasswordReset: async ({
      user,
    }: {
      user: { email: string; name?: string };
    }) => {
      console.log(
        `Password for user ${user.email} has been reset successfully.`
      );
    },
  },
  plugins: [
    admin(),
    apiKey(),
    genericOAuth({
      config: [
        {
          providerId: "yandex",
          clientId: "050a932f9210469e9d06e6cd4fcecc9f",
          clientSecret: "8e602597d3f94be6a14079adeb490169",
          authorizationUrl: "https://oauth.yandex.ru/authorize",
          tokenUrl: "https://oauth.yandex.ru/token",
          userInfoUrl: "https://login.yandex.ru/info?format=json",
          responseType: "code",
          scopes: ["login:email", "login:info"],
          pkce: true,
          getUserInfo: async (tokens) => {
            const userInfo = await fetch(
              "https://login.yandex.ru/info?format=json",
              {
                headers: {
                  Authorization: `Bearer ${tokens.accessToken}`,
                },
              }
            );

            const data: any = await userInfo.json();

            return {
              id: data.id,
              email: data.default_email,
              name: data.real_name,
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        },
      ],
    }),
  ],
});
