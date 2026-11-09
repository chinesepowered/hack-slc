# Dash0: what we found and fixed

## Agent0 found what made search slow

We asked Agent0, over the Dash0 MCP server, what dominated `GET /api/search`
in service `capykube`. From the traces of the last hour it answered:

> The OpenAI embeddings call (`embeddings text-embedding-3-small` to
> api.openai.com) is what makes `GET /api/search` slow. It averages about
> 410 ms (range 176–857 ms), against about 34 ms for the Elasticsearch query
> (median ~16 ms). That is roughly 92% of request time. The service waits for
> the embedding to come back before it starts the Elasticsearch query, so the
> two times add up.

It recommended caching query embeddings keyed on the normalized query text,
taking the embedding off the request path or putting a deadline on it, and
keeping the connection to OpenAI open.

## What we changed

`app/src/server/embeddings.ts`:

1. **Memory cache**, then **a cache index in Elasticsearch**
   (`capykube-query-embeddings`), so a restart doesn't pay OpenAI again.
2. **A 600 ms deadline** on the OpenAI call. Past it, search answers with
   keywords, and the embedding finishes in the background and fills both
   caches. Concurrent requests for the same query share one call.
3. **Warm-up** of the phone's suggested searches at start-up, so the first
   tap is a cache hit.
4. A metric, `capykube.search.embedding_lookups`, records where each
   embedding came from: `memory`, `elasticsearch`, `openai` or `deadline`.

Along the way we hit an Elasticsearch 9 detail: `dense_vector` values are
left out of `_source` by default, so a cache that stored vectors as
`dense_vector` could never read them back. The cache stores plain floats
instead.

## Before and after (local, same queries)

| | Search latency |
| --- | --- |
| Before: every new query | 176–857 ms (OpenAI embedding + ~16 ms Elasticsearch) |
| After: repeat query | 13–15 ms (memory) |
| After: repeat query after a restart | 16–21 ms (Elasticsearch cache) |
| After: suggested searches, first tap | ~21 ms (warmed up) |

## The SLO and Capy's mood

`observability/dash0/` holds the dashboard and the SLO as code ("99% of Plan
B decisions under 500 ms"); `scripts/dash0-apply.sh` applies them. The app
reads the same SLO from Dash0's PromQL API to set Capy's mood on the live
board.
