// Runs against a real Elasticsearch (CI starts one as a service container):
// bootstraps the indices and data, then checks keyword search and that the
// stored vectors rank the 2:00 PM talks the way the Plan B demo expects.
import { beforeAll, describe, expect, it } from 'vitest';
import { bootstrap, es } from '../../src/server/es';
import { INDEX } from '../../src/server/es-mappings';
import { searchTalks } from '../../src/server/search';
import { loadData } from '../../src/server/data';

describe('elasticsearch data layer', () => {
  beforeAll(async () => {
    await bootstrap();
  }, 120_000);

  it('indexes every talk with its embedding', async () => {
    const { talks } = loadData();
    const { count } = await es.count({ index: INDEX.talks });
    expect(count).toBe(talks.length);
  });

  it('finds the eBPF security talk by keyword', async () => {
    const res = await searchTalks('ebpf runtime security', 5);
    expect(res.mode).toBe('keyword'); // no OpenAI key in CI
    expect(res.hits[0]?.talk.id).toBe('t-155e-s4');
  });

  it('ranks the closest 2:00 PM alternatives to the full talk by meaning', async () => {
    const { vectors } = loadData();
    const res = await es.search<{ id: string }>({
      index: INDEX.talks,
      size: 3,
      timeout: '2s',
      _source: ['id'],
      query: {
        script_score: {
          query: { bool: { filter: [{ term: { slot: 'S4' } }], must_not: [{ term: { roomId: '155E' } }] } },
          script: { source: "cosineSimilarity(params.v, 'embedding')", params: { v: vectors.get('t-155e-s4') } },
        },
      },
    });
    const ids = res.hits.hits.map((h) => h._source?.id);
    expect(ids).toContain('t-251-s4');
    expect(ids).toContain('t-355a-s4');
  });
});
