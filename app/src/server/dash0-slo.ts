// Capy's mood comes from Dash0: the same Plan B SLO the Dash0 dashboard shows
// (decisions under 500 ms over the last 15 minutes), read through Dash0's
// PromQL API. Cached for 30 seconds; null when Dash0 isn't configured or
// doesn't answer, so the caller can fall back to the local window.
import { config } from './config';
import { log } from './log';
import type { CapyMoodResponse } from '../shared/live-types';

const CACHE_MS = 30_000;
const GOOD = 'sum(rate(capykube_planb_duration_milliseconds_bucket{le="500"}[15m])) / sum(rate(capykube_planb_duration_milliseconds_count[15m]))';
const P95 = 'histogram_quantile(0.95, sum by (le) (rate(capykube_planb_duration_milliseconds_bucket[15m])))';

let cached: { at: number; mood: CapyMoodResponse | null } | null = null;

async function instant(query: string): Promise<number | null> {
  const params = new URLSearchParams({ query, dataset: config.dash0.dataset });
  const res = await fetch(`${config.dash0.apiEndpoint}/api/prometheus/api/v1/query?${params}`, {
    headers: { Authorization: `Bearer ${config.dash0.token}` },
    signal: AbortSignal.timeout(3_000),
  });
  if (!res.ok) throw new Error(`Dash0 PromQL answered ${res.status}`);
  const body = (await res.json()) as { data?: { result?: Array<{ value: [number, string] }> } };
  const value = Number(body.data?.result?.[0]?.value?.[1]);
  return Number.isFinite(value) ? value : null;
}

export async function dash0Mood(): Promise<CapyMoodResponse | null> {
  if (!config.dash0.token) return null;
  // Real time, not demo time: this paces calls to an external API.
  if (cached && performance.now() - cached.at < CACHE_MS) return cached.mood;
  let mood: CapyMoodResponse | null = null;
  try {
    const [goodRatio, p95Ms] = await Promise.all([instant(GOOD), instant(P95)]);
    if (goodRatio !== null) {
      mood = {
        mood: goodRatio >= 0.99 ? 'chill' : goodRatio >= 0.95 ? 'happy' : 'worried',
        source: 'dash0',
        goodRatio,
        p95Ms: p95Ms === null ? null : Math.round(p95Ms),
        detail: `${(goodRatio * 100).toFixed(1)}% of Plan B decisions under 500 ms${p95Ms === null ? '' : ` · p95 ${Math.round(p95Ms)} ms`} (last 15 min)`,
      };
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'Dash0 SLO query failed; Capy reads the local window');
  }
  cached = { at: performance.now(), mood };
  return mood;
}
