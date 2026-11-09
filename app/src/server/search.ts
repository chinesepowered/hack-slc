// Hybrid talk search: BM25 over titles, abstracts and tags, fused with kNN
// over the talk embeddings by Elasticsearch's reciprocal rank fusion. Falls
// back to keyword-only when the query can't be embedded.
import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { es } from './es';
import { INDEX } from './es-mappings';
import { embedQuery } from './embeddings';
import { searchDuration, searchRequests, searchZeroResults } from './metrics';
import type { SearchResponse, Talk } from '../shared/api-types';

const MAX_RESULTS = 20;
const STOPWORDS = new Set(['a', 'an', 'and', 'or', 'the', 'on', 'of', 'in', 'for', 'to', 'with', 'about', 'something', 'talk', 'talks', 'me', 'i', 'want', 'some']);

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** True when any meaningful query word appears in the text (prefixes of 4+ letters count). */
export function sharesWords(query: string, text: string): boolean {
  const words = new Set(tokens(text));
  return tokens(query).some((t) => words.has(t) || [...words].some((w) => w.startsWith(t) && t.length >= 4));
}

export async function searchTalks(query: string, limit = 10): Promise<SearchResponse> {
  const started = performance.now();
  const size = Math.min(Math.max(limit, 1), MAX_RESULTS);
  const vector = await embedQuery(query);
  const mode: SearchResponse['mode'] = vector ? 'hybrid' : 'keyword';

  const keyword: estypes.QueryDslQueryContainer = {
    multi_match: {
      query,
      fields: ['title^3', 'tags^2', 'abstract', 'track'],
      type: 'best_fields',
    },
  };

  const request: estypes.SearchRequest = vector
    ? {
        index: INDEX.talks,
        size,
        timeout: '2s',
        _source: { excludes: ['embedding'] },
        retriever: {
          rrf: {
            retrievers: [
              { standard: { query: keyword } },
              { knn: { field: 'embedding', query_vector: vector, k: 20, num_candidates: 100 } },
            ],
            rank_window_size: 50,
            rank_constant: 20,
          },
        },
      }
    : {
        index: INDEX.talks,
        size,
        timeout: '2s',
        _source: { excludes: ['embedding'] },
        query: keyword,
      };

  const res = await es.search<Talk>(request);
  const hits = res.hits.hits
    .filter((h) => h._source)
    .map((h) => ({
      talk: h._source as Talk,
      score: h._score ?? 0,
      titleOverlap: sharesWords(query, (h._source as Talk).title),
    }));

  const tookMs = Math.round(performance.now() - started);
  const span = trace.getActiveSpan();
  span?.setAttributes({
    'capykube.search.mode': mode,
    'capykube.search.query_words': tokens(query).length,
    'capykube.search.results': hits.length,
  });
  searchRequests.add(1, { mode });
  searchDuration.record(tookMs, { mode });
  if (hits.length === 0) searchZeroResults.add(1, { mode });

  return { query, mode, tookMs, hits };
}
