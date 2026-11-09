// Multilingual search on Elastic Cloud Serverless. The in-cluster
// Elasticsearch stays the core (scheduler, live state, insights); this second
// project shows the other half of Elastic: Jina embeddings and reranking as a
// managed service. A `semantic_text` field embeds every talk with
// jina-embeddings-v5 at ingest, so a question in Spanish or Japanese finds the
// English talk, and jina-reranker-v3.5 reorders the fused results.
import { Client } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { loadData } from './data';
import { log } from './log';
import { searchDuration, searchRequests, searchZeroResults } from './metrics';
import type { SearchResponse, Talk } from '../shared/api-types';

const INDEX = 'capykube-talks-multilingual';
const EMBEDDINGS = process.env.ES_CLOUD_EMBEDDINGS ?? '.jina-embeddings-v5-text-small';
const RERANKER = process.env.ES_CLOUD_RERANKER ?? '.jina-reranker-v3.5';

const url = process.env.ES_CLOUD_URL;
const apiKey = process.env.ES_CLOUD_API_KEY;
export const cloud = url && apiKey ? new Client({ node: url, auth: { apiKey }, requestTimeout: 15_000, maxRetries: 1 }) : null;

let ready = false;
export const cloudReady = () => ready;

const mappings: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    title: { type: 'text' },
    // What Jina embeds and the reranker reads: title, abstract and tags.
    content: { type: 'semantic_text', inference_id: EMBEDDINGS },
    rerank_text: { type: 'text' },
    talk: { type: 'object', enabled: false },
  },
};

export async function bootstrapCloud(): Promise<void> {
  if (!cloud) return;
  try {
    if (!(await cloud.indices.exists({ index: INDEX }))) {
      await cloud.indices.create({ index: INDEX, mappings });
      log.info({ index: INDEX, embeddings: EMBEDDINGS }, 'created the multilingual index on Elastic Cloud');
    }
    const { talks } = loadData();
    const { count } = await cloud.count({ index: INDEX });
    if (count !== talks.length) {
      const operations = talks.flatMap((t) => {
        const text = `${t.title}. ${t.abstract} Topics: ${t.tags.join(', ')}.`;
        return [{ index: { _index: INDEX, _id: t.id } }, { id: t.id, title: t.title, content: text, rerank_text: text, talk: t }];
      });
      const res = await cloud.bulk({ operations, refresh: 'wait_for', timeout: '2m' }, { requestTimeout: 180_000 });
      if (res.errors) throw new Error(JSON.stringify(res.items.find((i) => i.index?.error)?.index?.error));
      log.info({ talks: talks.length }, 'indexed talks with Jina embeddings on Elastic Cloud');
    }
    ready = true;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'Elastic Cloud bootstrap failed; multilingual search is off');
  }
}

export async function searchMultilingual(query: string, limit = 8): Promise<SearchResponse> {
  if (!cloud || !ready) throw Object.assign(new Error('multilingual search is not configured'), { statusCode: 503 });
  const started = performance.now();
  const size = Math.min(Math.max(limit, 1), 20);
  const res = await cloud.search<{ talk: Talk }>({
    index: INDEX,
    size,
    timeout: '5s',
    _source: ['talk'],
    retriever: {
      text_similarity_reranker: {
        retriever: {
          rrf: {
            retrievers: [
              { standard: { query: { multi_match: { query, fields: ['title^2', 'rerank_text'] } } } },
              { standard: { query: { semantic: { field: 'content', query } } } },
            ],
            rank_window_size: 30,
          },
        },
        field: 'rerank_text',
        inference_id: RERANKER,
        inference_text: query,
        rank_window_size: 20,
      },
    },
  });
  const hits = res.hits.hits
    .filter((h) => h._source?.talk)
    .map((h) => ({ talk: h._source!.talk, score: h._score ?? 0, titleOverlap: false }));
  const tookMs = Math.round(performance.now() - started);
  trace.getActiveSpan()?.setAttributes({ 'capykube.search.mode': 'multilingual', 'capykube.search.results': hits.length });
  searchRequests.add(1, { mode: 'multilingual' });
  searchDuration.record(tookMs, { mode: 'multilingual' });
  if (hits.length === 0) searchZeroResults.add(1, { mode: 'multilingual' });
  return { query, mode: 'multilingual', tookMs, hits };
}
