import Fastify from "fastify";
import cookie from "@fastify/cookie";

// Plugins
import corsPlugin from "./plugins/cors";
import multipartPlugin from "./plugins/multipart";
import authPlugin from "./plugins/auth";
import errorHandlerPlugin from "./plugins/error-handler";

// Routes
import modelsRoutes from "./routes/models";
import themesRoutes from "./routes/themes";
import themeAssetsRoutes from "./routes/themes/assets";
import plansRoutes from "./routes/plans";
import feedbackRoutes from "./routes/feedback";
import promoCodeRoutes from "./routes/promo-code";
import teamsRoutes from "./routes/teams";
import searchRoutes from "./routes/search";
import uploadRoutes from "./routes/upload";
import subscriptionRoutes from "./routes/subscription";
import presentationsRoutes from "./routes/presentations";
import generateRoutes from "./routes/generate";
import chatRoutes from "./routes/chat";
import exportRoutes from "./routes/export";
import v1Routes from "./routes/v1";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB
    trustProxy: true,
  });

  // Allow empty JSON body
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const str = (body as string).trim();
        done(null, str ? JSON.parse(str) : undefined);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Register plugins (order matters)
  await app.register(corsPlugin);
  await app.register(cookie);
  await app.register(multipartPlugin);
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);

  // Register route plugins
  await app.register(modelsRoutes);
  await app.register(themesRoutes);
  await app.register(themeAssetsRoutes);
  await app.register(plansRoutes);
  await app.register(feedbackRoutes);
  await app.register(promoCodeRoutes);
  await app.register(teamsRoutes);
  await app.register(searchRoutes);
  await app.register(uploadRoutes);
  await app.register(subscriptionRoutes);
  await app.register(presentationsRoutes);
  await app.register(generateRoutes);
  await app.register(chatRoutes);
  await app.register(exportRoutes);
  await app.register(v1Routes);

  return app;
}
