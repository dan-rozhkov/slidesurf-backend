import fp from "fastify-plugin";
import { FastifyError } from "fastify";

export default fp(async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode || 500;

    fastify.log.error({
      err: error,
      url: request.url,
      method: request.method,
    });

    // Surface a message to the client only for validation errors (safe, useful
    // feedback); mask everything else so incidental internal/library detail and
    // user-enumeration hints don't leak. Full error is logged above.
    const isValidation =
      (error as { validation?: unknown }).validation != null ||
      error.name === "ZodError";

    reply.status(statusCode).send({
      error:
        statusCode >= 500
          ? "Internal Server Error"
          : isValidation
          ? error.message
          : "Request failed",
      statusCode,
    });
  });
});
