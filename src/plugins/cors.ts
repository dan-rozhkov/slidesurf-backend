import fp from "fastify-plugin";
import cors from "@fastify/cors";

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: [process.env.FRONTEND_URL!],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: [
      "X-Subscription-Plan",
      "X-Subscription-Limits",
      "X-Plan-Id",
    ],
  });
});
