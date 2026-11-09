// Query embeddings. Agent0 found the OpenAI embedding call was ~92% of
// /api/search latency (≈410 ms against ≈34 ms for Elasticsearch), so:
//   1. memory cache, then
//   2. a cache index in Elasticsearch that survives restarts, then
//   3. OpenAI, with a deadline: past it, search answers with keywords and the
//      embedding finishes in the background to fill both caches.
import OpenAI from 'openai';
import { config } from './config';
import { log } from './log';
import { es } from './es';
import { INDEX } from './es-mappings';
import { embeddingCache } from './metrics';

const client = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 5_000, maxRetries: 1 }) : null;

const memory = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[] | null>>();
const MAX_MEMORY = 500;

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

function remember(key: string, vector: number[]) {
  if (memory.size >= MAX_MEMORY) memory.delete(memory.keys().next().value as string);
  memory.set(key, vector);
}

async function fromIndex(key: string): Promise<number[] | null> {
  try {
    const res = await es.get<{ vector: number[] }>({ index: INDEX.queryEmbeddings, id: key }, { ignore: [404], requestTimeout: 1_000 });
    return res.found && res._source ? res._source.vector : null;
  } catch {
    return null;
  }
}

function fetchEmbedding(key: string): Promise<number[] | null> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await client!.embeddings.create({
        model: config.openai.embeddingModel,
        input: key,
        dimensions: config.openai.embeddingDimensions,
      });
      const vector = res.data[0]?.embedding ?? null;
      if (vector) {
        remember(key, vector);
        es.index({ index: INDEX.queryEmbeddings, id: key, document: { query: key, vector, model: config.openai.embeddingModel } }).catch(
          (err) => log.warn({ err: (err as Error).message }, 'could not store a query embedding'),
        );
      }
      return vector;
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'query embedding failed');
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * The query's embedding, or null when OpenAI isn't configured or doesn't
 * answer within budgetMs (the call keeps going and fills the caches).
 */
export async function embedQuery(text: string, budgetMs = 600): Promise<number[] | null> {
  if (!client) return null;
  const key = normalize(text);
  const hot = memory.get(key);
  if (hot) {
    embeddingCache.add(1, { tier: 'memory' });
    return hot;
  }
  const stored = await fromIndex(key);
  if (stored) {
    remember(key, stored);
    embeddingCache.add(1, { tier: 'elasticsearch' });
    return stored;
  }
  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs));
  const vector = await Promise.race([fetchEmbedding(key), deadline]);
  embeddingCache.add(1, { tier: vector ? 'openai' : 'deadline' });
  return vector;
}

/** Embeds the phone's suggested searches so the first tap is a cache hit. */
export async function warmUp(queries: string[]) {
  await Promise.all(queries.map((q) => embedQuery(q, 10_000)));
  log.info({ queries: queries.length }, 'warmed up query embeddings');
}
