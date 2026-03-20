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

    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : error.message,
      statusCode,
    });
  });
});
