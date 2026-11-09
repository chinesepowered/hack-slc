// The web app's only way to talk to the server. Keep in step with
// app/src/shared/api-types.ts and the routes in app/src/server/routes/.
import type { RoomInfo, SearchResponse, Talk, TalksResponse, VersionResponse } from '../shared/api-types';
import type { ClockState, Insights, LiveSnapshot, PlanBHoldResponse, PlanBPreview, StreamEvent } from '../shared/live-types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return (await res.json()) as T;
}

async function send<T>(method: 'POST' | 'DELETE', path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return (await res.json()) as T;
}

export interface PlanBOptions {
  quiet?: boolean;
  stepFree?: boolean;
}

export const api = {
  version: () => get<VersionResponse>('/api/version'),
  rooms: () => get<RoomInfo[]>('/api/rooms'),
  talks: (params: { slot?: string; roomId?: string } = {}) =>
    get<TalksResponse>(`/api/talks?${new URLSearchParams(params)}`),
  talk: (id: string) => get<Talk>(`/api/talks/${encodeURIComponent(id)}`),
  search: (q: string, limit = 10) => get<SearchResponse>(`/api/search?${new URLSearchParams({ q, limit: String(limit) })}`),

  snapshot: () => get<LiveSnapshot>('/api/live/snapshot'),
  planB: (talkId: string, opts: PlanBOptions = {}) =>
    get<PlanBPreview>(`/api/planb?${new URLSearchParams({ talkId, quiet: String(!!opts.quiet), stepFree: String(!!opts.stepFree) })}`),
  holdSeat: (fromTalkId: string, toTalkId: string, opts: PlanBOptions = {}) =>
    send<PlanBHoldResponse>('POST', '/api/planb/hold', { fromTalkId, toTalkId, ...opts }),
  releaseHold: (id: string) => send<{ released: boolean }>('DELETE', `/api/planb/hold/${encodeURIComponent(id)}`),
  setDoor: (roomId: string, full: boolean) =>
    send<{ roomId: string; full: boolean }>('POST', `/api/rooms/${encodeURIComponent(roomId)}/door`, { full }),
  setClock: (change: { at?: string | number; speed?: number; paused?: boolean }, opsKey?: string) =>
    send<ClockState>('POST', '/api/sim/clock', change, opsKey ? { 'x-ops-key': opsKey } : {}),
  insights: () => get<Insights>('/api/insights'),

  /** Live updates; returns a function that closes the stream. */
  stream(onEvent: (event: StreamEvent) => void): () => void {
    const source = new EventSource('/api/live/stream');
    for (const type of ['snapshot', 'tick', 'agents', 'planb', 'door'] as const) {
      source.addEventListener(type, (e) => onEvent({ type, data: JSON.parse((e as MessageEvent).data) } as StreamEvent));
    }
    return () => source.close();
  },
};
