// The web app's only way to talk to the server. Keep in step with
// app/src/shared/api-types.ts and the routes in app/src/server/routes/.
import type { RoomInfo, SearchResponse, Talk, TalksResponse, VersionResponse } from '../shared/api-types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  version: () => get<VersionResponse>('/api/version'),
  rooms: () => get<RoomInfo[]>('/api/rooms'),
  talks: (params: { slot?: string; roomId?: string } = {}) =>
    get<TalksResponse>(`/api/talks?${new URLSearchParams(params)}`),
  talk: (id: string) => get<Talk>(`/api/talks/${encodeURIComponent(id)}`),
  search: (q: string, limit = 10) => get<SearchResponse>(`/api/search?${new URLSearchParams({ q, limit: String(limit) })}`),
};
