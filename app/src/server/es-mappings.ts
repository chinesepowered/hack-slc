// Index names and mappings. The bootstrap in es.ts creates each index with
// these mappings; change a mapping only together with that bootstrap.
import type { estypes } from '@elastic/elasticsearch';

export const INDEX = {
  talks: 'capykube-talks',
  rooms: 'capykube-rooms',
  roomStatus: 'capykube-room-status',
  planb: 'capykube-planb-events',
  queryEmbeddings: 'capykube-query-embeddings',
} as const;

export const EMBEDDING_DIMS = 512;

const talks: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    kind: { type: 'keyword' },
    title: { type: 'text', analyzer: 'english', fields: { raw: { type: 'keyword' } } },
    abstract: { type: 'text', analyzer: 'english' },
    track: { type: 'keyword' },
    level: { type: 'keyword' },
    // Searchable as text ("ebpf" matches "ebpf"), aggregatable as keyword.
    tags: { type: 'text', analyzer: 'english', fields: { kw: { type: 'keyword' } } },
    speakers: {
      properties: {
        name: { type: 'text' },
        company: { type: 'keyword' },
      },
    },
    roomId: { type: 'keyword' },
    slot: { type: 'keyword' },
    start: { type: 'date' },
    end: { type: 'date' },
    interest: { type: 'integer' },
    captioned: { type: 'boolean' },
    embedding: { type: 'dense_vector', dims: EMBEDDING_DIMS, similarity: 'cosine', index: true },
  },
};

const rooms: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    id: { type: 'keyword' },
    name: { type: 'text', fields: { raw: { type: 'keyword' } } },
    kind: { type: 'keyword' },
    level: { type: 'integer' },
    capacity: { type: 'integer' },
    track: { type: 'keyword' },
    stepFree: { type: 'boolean' },
    note: { type: 'text' },
  },
};

// One document per room, upserted as the room fills and empties.
const roomStatus: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    roomId: { type: 'keyword' },
    present: { type: 'integer' },
    held: { type: 'integer' },
    capacity: { type: 'integer' },
    full: { type: 'boolean' },
    fullSource: { type: 'keyword' },
    talkId: { type: 'keyword' },
    simTime: { type: 'date' },
    updatedAt: { type: 'date' },
  },
};

// Every Plan B request: one row of demand the room couldn't take.
const planb: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    '@timestamp': { type: 'date' },
    simTime: { type: 'date' },
    runId: { type: 'keyword' },
    source: { type: 'keyword' },
    fromTalkId: { type: 'keyword' },
    fromRoomId: { type: 'keyword' },
    fromTitle: { type: 'text' },
    track: { type: 'keyword' },
    tags: { type: 'keyword' },
    people: { type: 'integer' },
    placed: { type: 'integer' },
    unplaced: { type: 'integer' },
    quiet: { type: 'boolean' },
    stepFree: { type: 'boolean' },
    latencyMs: { type: 'float' },
    placements: {
      properties: {
        talkId: { type: 'keyword' },
        roomId: { type: 'keyword' },
        people: { type: 'integer' },
        score: { type: 'float' },
      },
    },
  },
};

// Search-query embeddings, cached so a restart doesn't pay OpenAI again.
// Plain floats, not dense_vector: Elasticsearch 9 leaves dense_vector values
// out of _source, and the cache is read by id, never searched.
const queryEmbeddings: estypes.MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    query: { type: 'keyword' },
    model: { type: 'keyword' },
    vector: { type: 'float', index: false, doc_values: false },
  },
};

export const MAPPINGS: Record<(typeof INDEX)[keyof typeof INDEX], estypes.MappingTypeMapping> = {
  [INDEX.queryEmbeddings]: queryEmbeddings,
  [INDEX.talks]: talks,
  [INDEX.rooms]: rooms,
  [INDEX.roomStatus]: roomStatus,
  [INDEX.planb]: planb,
};
