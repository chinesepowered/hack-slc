import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { log } from './log';

async function main() {
  const app = Fastify({ loggerInstance: log, trustProxy: true });

  app.get('/healthz', async () => 'ok');
  app.get('/readyz', async () => 'ok');

  app.get('/api/version', async () => ({
    name: 'capykube',
    version: config.version,
    team: config.team,
  }));

  await app.register(fastifyStatic, {
    root: path.resolve(config.webDir),
    wildcard: false,
  });

  // Single-page app: unknown non-API paths serve index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html');
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  log.info({ port: config.port, version: config.version }, 'capykube listening');

  // Exit cleanly when Kubernetes stops the pod, so rollouts don't drop requests.
  process.once('SIGTERM', () => {
    app.close().then(() => process.exit(0), () => process.exit(1));
  });
}

main().catch((err) => {
  log.fatal({ err }, 'capykube failed to start');
  process.exit(1);
});
