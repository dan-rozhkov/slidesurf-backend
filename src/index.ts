import { buildApp } from "./app";

const start = async () => {
  const app = await buildApp();

  const port = Number(process.env.PORT) || 3001;
  const host = "0.0.0.0";

  try {
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start();
