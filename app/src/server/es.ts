// The Elasticsearch client and the bootstrap that prepares the cluster:
// trial license (like start-local), indices with their mappings, and the
// conference data. Safe to run on every start.
import { Client, errors } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { config } from './config';
import { log } from './log';
import { INDEX, MAPPINGS } from './es-mappings';
import { loadData } from './data';

export const es = new Client({
  node: config.es.url,
  auth: config.es.password ? { username: config.es.username, password: config.es.password } : undefined,
  requestTimeout: 5_000,
  maxRetries: 2,
});

const tracer = trace.getTracer('capykube');

let ready = false;
export const isReady = () => ready;

async function waitForCluster(): Promise<void> {
  const deadline = Date.now() + 5 * 60_000;
  for (let attempt = 1; ; attempt++) {
    try {
      await es.cluster.health({ wait_for_status: 'yellow', timeout: '5s' });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
      log.info({ attempt, err: (err as Error).message }, 'waiting for elasticsearch');
      await new Promise((r) => setTimeout(r, Math.min(10_000, 1_000 * attempt)));
    }
  }
}

async function ensureTrialLicense(): Promise<void> {
  try {
    const { license } = await es.license.get();
    if (license.type === 'basic') {
      await es.license.postStartTrial({ acknowledge: true });
      log.info('started the Elasticsearch trial license');
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'could not check or start the trial license');
  }
}

async function ensureIndices(): Promise<void> {
  for (const [index, mappings] of Object.entries(MAPPINGS)) {
    const exists = await es.indices.exists({ index });
    if (exists) {
      // Mappings only ever gain fields, which Elasticsearch applies in place.
      await es.indices.putMapping({ index, ...mappings });
    } else {
      try {
        await es.indices.create({
          index,
          mappings,
          settings: { number_of_shards: 1, number_of_replicas: 0, refresh_interval: '1s' },
        });
        log.info({ index }, 'created index');
      } catch (err) {
        // Another pod may have created it between the check and the create.
        if (!(err instanceof errors.ResponseError && err.statusCode === 400)) throw err;
      }
    }
  }
}

async function seed(): Promise<void> {
  const { talks, vectors, rooms } = loadData();
  const operations = [
    ...talks.flatMap((t) => [
      { index: { _index: INDEX.talks, _id: t.id } },
      { ...t, embedding: vectors.get(t.id) },
    ]),
    ...rooms.map((r) => {
      const { x: _x, y: _y, w: _w, h: _h, ...doc } = r;
      return [{ index: { _index: INDEX.rooms, _id: r.id } }, doc];
    }).flat(),
  ];
  const res = await es.bulk({ operations, refresh: 'wait_for' });
  if (res.errors) {
    const first = res.items.find((i) => i.index?.error)?.index?.error;
    throw new Error(`seeding failed: ${JSON.stringify(first)}`);
  }
  log.info({ talks: talks.length, rooms: rooms.length }, 'seeded conference data');
}

/** Prepares Elasticsearch; the app reports ready once this succeeds. */
export async function bootstrap(): Promise<void> {
  await tracer.startActiveSpan('capykube.bootstrap', async (span) => {
    try {
      await waitForCluster();
      await ensureTrialLicense();
      await ensureIndices();
      await seed();
      ready = true;
    } catch (err) {
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
