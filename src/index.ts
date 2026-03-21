import http from "node:http";
import { buildApp } from "./app";

const port = Number(process.env.PORT) || 3001;
const host = "0.0.0.0";

let app = await buildApp();
await app.ready();

const server = http.createServer((req, res) => {
  app.server.emit("request", req, res);
});

server.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down...");
  server.close();
  app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Hot Module Replacement — swap Fastify app without restarting the server
if (import.meta.hot) {
  import.meta.hot.accept("./app", async (mod) => {
    try {
      const oldApp = app;
      app = await mod!.buildApp();
      await app.ready();
      await oldApp.close();
      console.log("HMR: app reloaded");
    } catch (err) {
      console.error("HMR: reload failed", err);
    }
  });
}
