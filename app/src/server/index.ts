import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { log } from './log';
import { bootstrap, isReady } from './es';
import { talkRoutes } from './routes/talks';
import { liveRoutes } from './routes/live';
import { rumRoutes } from './routes/rum';
import { simulator } from './simulator';
import { registerGauges } from './gauges';
import { bootstrapCloud } from './es-cloud';

async function main() {
  const app = Fastify({ loggerInstance: log, trustProxy: true });

  app.get('/healthz', async () => 'ok');
  // Ready once Elasticsearch has its indices and the conference data.
  app.get('/readyz', async (_req, reply) => (isReady() ? 'ok' : reply.code(503).send('warming up')));

  app.get('/api/version', async () => ({
    name: 'capykube',
    version: config.version,
    team: config.team,
  }));

  await app.register(talkRoutes);
  await app.register(liveRoutes);
  await app.register(rumRoutes);

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

  bootstrap().then(
    () => {
      log.info('elasticsearch ready');
      registerGauges();
      simulator.start();
      void bootstrapCloud();
    },
    (err) => {
      log.fatal({ err }, 'elasticsearch bootstrap failed');
      process.exit(1);
    },
  );

  // Exit cleanly when Kubernetes stops the pod, so rollouts don't drop requests.
  process.once('SIGTERM', async () => {
    try {
      await app.close();
      await (globalThis as any).__otelShutdown?.();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

main().catch((err) => {
  log.fatal({ err }, 'capykube failed to start');
  process.exit(1);
});
