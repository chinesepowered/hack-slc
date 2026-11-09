// Forwards the browser's OpenTelemetry (Dash0 web SDK) to Dash0 with the
// server's token, so no token ships to the browser. Only the three OTLP paths
// are forwarded, bodies are capped, and nothing is forwarded without a token.
import type { FastifyInstance } from 'fastify';
import { config } from '../config';

const ALLOWED = new Set(['v1/traces', 'v1/logs', 'v1/metrics']);

export async function rumRoutes(app: FastifyInstance) {
  app.addContentTypeParser(['application/json', 'application/x-protobuf', 'text/plain'], { parseAs: 'buffer', bodyLimit: 1_048_576 }, (_req, body, done) =>
    done(null, body),
  );

  app.post<{ Params: { '*': string } }>('/rum/*', async (req, reply) => {
    const path = req.params['*'];
    if (!ALLOWED.has(path)) return reply.code(404).send();
    if (!config.dash0.token) return reply.code(204).send();
    const res = await fetch(`${config.dash0.otlpEndpoint}/${path}`, {
      method: 'POST',
      headers: {
        'content-type': String(req.headers['content-type'] ?? 'application/json'),
        authorization: `Bearer ${config.dash0.token}`,
        'Dash0-Dataset': config.dash0.dataset,
      },
      body: new Uint8Array(req.body as Buffer),
    });
    return reply.code(res.status).send(Buffer.from(await res.arrayBuffer()));
  });
}
