// The contract between the server and the web app. Server routes return
// these shapes; app/src/web/api.ts is the only client.

export interface Speaker {
  name: string;
  company: string;
}

export interface Talk {
  id: string;
  kind: 'session' | 'keynote';
  title: string;
  abstract: string;
  track: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
  speakers: Speaker[];
  roomId: string;
  slot: string;
  /** UTC ISO-8601. Render with app/src/shared/time.ts. */
  start: string;
  end: string;
  interest: number;
  captioned: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  kind: 'keynote' | 'session' | 'quiet' | 'amenity';
  level: number;
  capacity: number;
  track: string;
  stepFree: boolean;
  note?: string;
}

export interface VersionResponse {
  name: string;
  version: string;
  team: string;
}

export interface SearchHit {
  talk: Talk;
  /** Reciprocal-rank-fusion score from Elasticsearch. */
  score: number;
  /** False when none of the query's words are in the title: Elasticsearch found it by meaning. */
  titleOverlap: boolean;
}

export interface SearchResponse {
  query: string;
  /** hybrid: in-cluster BM25 + kNN fused with RRF. multilingual: Jina on Elastic Cloud Serverless, reranked. */
  mode: 'hybrid' | 'keyword' | 'multilingual';
  tookMs: number;
  hits: SearchHit[];
}

export interface TalksResponse {
  talks: Talk[];
}
