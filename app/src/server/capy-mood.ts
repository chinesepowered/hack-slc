// Capy's mood is the app's health, in capybara. Until the Dash0 SLO is wired
// in, it reads the last few minutes of Plan B decisions kept in memory:
// chill when 99% finish under 500 ms and nobody is left without a seat.
import type { CapyMoodResponse } from '../shared/live-types';

const SLO_MS = 500;
const WINDOW = 200;
const recent: Array<{ ms: number; unplaced: number }> = [];

export function observePlanB(ms: number, unplaced: number) {
  recent.push({ ms, unplaced });
  if (recent.length > WINDOW) recent.shift();
}

export function localMood(): CapyMoodResponse {
  if (recent.length === 0) {
    return { mood: 'chill', source: 'local', goodRatio: null, p95Ms: null, detail: 'No Plan B decisions yet' };
  }
  const sorted = recent.map((r) => r.ms).sort((a, b) => a - b);
  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const goodRatio = recent.filter((r) => r.ms < SLO_MS).length / recent.length;
  const unplaced = recent.reduce((s, r) => s + r.unplaced, 0);
  const mood = goodRatio >= 0.99 && unplaced === 0 ? 'chill' : goodRatio >= 0.95 ? 'happy' : 'worried';
  return {
    mood,
    source: 'local',
    goodRatio,
    p95Ms,
    detail: `${Math.round(goodRatio * 1000) / 10}% of the last ${recent.length} Plan B decisions under ${SLO_MS} ms`,
  };
}
