// Loads the conference data that ships with the image: the talks, their
// precomputed embeddings, and the rooms.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import type { Talk } from '../shared/api-types';
import { ROOMS } from '../shared/venue';

interface TalksFile {
  talks: Talk[];
}

interface EmbeddingsFile {
  model: string;
  dimensions: number;
  vectors: Record<string, number[]>;
}

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(config.dataDir, name), 'utf8')) as T;
}

let cache: { talks: Talk[]; vectors: Map<string, number[]> } | undefined;

export function loadData() {
  if (!cache) {
    const { talks } = readJson<TalksFile>('talks.json');
    const { vectors } = readJson<EmbeddingsFile>('talk-embeddings.json');
    cache = { talks, vectors: new Map(Object.entries(vectors)) };
  }
  return { ...cache, rooms: ROOMS };
}
