// Query embeddings from OpenAI, cached. Talk embeddings are precomputed and
// ship with the data; only search queries are embedded at runtime.
import OpenAI from 'openai';
import { config } from './config';
import { log } from './log';

const client = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey, timeout: 3_000, maxRetries: 1 }) : null;

const cache = new Map<string, number[]>();
const MAX_CACHE = 500;

/** Returns null when OpenAI isn't configured or doesn't answer in time. */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!client) return null;
  const key = text.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const res = await client.embeddings.create({
      model: config.openai.embeddingModel,
      input: key,
      dimensions: config.openai.embeddingDimensions,
    });
    const vector = res.data[0]?.embedding ?? null;
    if (vector) {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(key, vector);
    }
    return vector;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'query embedding failed; falling back to keyword search');
    return null;
  }
}
