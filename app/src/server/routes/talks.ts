import type { FastifyInstance } from 'fastify';
import { es } from '../es';
import { INDEX } from '../es-mappings';
import { searchTalks } from '../search';
import { searchMultilingual } from '../es-cloud';
import { ROOMS } from '../../shared/venue';
import type { RoomInfo, SearchResponse, Talk, TalksResponse } from '../../shared/api-types';

export async function talkRoutes(app: FastifyInstance) {
  app.get('/api/rooms', async (): Promise<RoomInfo[]> =>
    ROOMS.map(({ x: _x, y: _y, w: _w, h: _h, ...room }) => room),
  );

  app.get<{ Querystring: { slot?: string; roomId?: string; after?: string } }>('/api/talks', async (req): Promise<TalksResponse> => {
    const filter = [];
    if (req.query.slot) filter.push({ term: { slot: req.query.slot } });
    if (req.query.roomId) filter.push({ term: { roomId: req.query.roomId } });
    const res = await es.search<Talk>({
      index: INDEX.talks,
      size: 50,
      timeout: '2s',
      _source: { excludes: ['embedding'] },
      query: { bool: { filter } },
      sort: [{ start: 'asc' }, { roomId: 'asc' }],
      ...(req.query.after ? { search_after: JSON.parse(req.query.after) } : {}),
    });
    return { talks: res.hits.hits.map((h) => h._source as Talk) };
  });

  app.get<{ Params: { id: string } }>('/api/talks/:id', async (req, reply) => {
    const res = await es.get<Talk>({ index: INDEX.talks, id: req.params.id, _source_excludes: ['embedding'] }, { ignore: [404] });
    if (!res.found || !res._source) return reply.code(404).send({ error: 'talk not found' });
    return res._source;
  });

  app.get<{ Querystring: { q?: string; limit?: string; lang?: string } }>('/api/search', async (req, reply): Promise<SearchResponse | void> => {
    const q = (req.query.q ?? '').trim().slice(0, 200);
    if (!q) return reply.code(400).send({ error: 'q is required' });
    const limit = Number(req.query.limit);
    const n = Number.isFinite(limit) ? limit : 10;
    // lang=any: ask in any language, answered by Jina on Elastic Cloud Serverless.
    if (req.query.lang === 'any') return searchMultilingual(q, n);
    return searchTalks(q, n);
  });
}
