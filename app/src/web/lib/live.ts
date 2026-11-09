// One live connection per page: keeps the room status, the capybaras and the
// Plan B feed in sync with the server, and estimates the demo clock between
// ticks so animations run smoothly.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AgentView, ClockState, PlanBEvent, RoomStatus } from '../../shared/live-types';

export interface LiveState {
  clock: ClockState;
  /** performance.now() when clock was received. */
  clockAt: number;
  rooms: Map<string, RoomStatus>;
  agents: Map<number, AgentView>;
  events: PlanBEvent[];
  turnedAway: number;
  connected: boolean;
  version: number;
}

const empty: LiveState = {
  clock: { now: 0, speed: 1, paused: true },
  clockAt: 0,
  rooms: new Map(),
  agents: new Map(),
  events: [],
  turnedAway: 0,
  connected: false,
  version: 0,
};

/** Simulated "now" in epoch ms, extrapolated from the last tick. */
export function simNow(s: Pick<LiveState, 'clock' | 'clockAt'>): number {
  if (s.clock.paused || !s.clockAt) return s.clock.now;
  return s.clock.now + (performance.now() - s.clockAt) * s.clock.speed;
}

export function useLive(): LiveState {
  const ref = useRef<LiveState>(empty);
  const [, setVersion] = useState(0);

  useEffect(() => {
    let raf = 0;
    const bump = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        ref.current = { ...ref.current, version: ref.current.version + 1 };
        setVersion(ref.current.version);
      });
    };
    const close = api.stream((event) => {
      const s = ref.current;
      switch (event.type) {
        case 'snapshot':
          s.clock = event.data.clock;
          s.clockAt = performance.now();
          s.rooms = new Map(event.data.rooms.map((r) => [r.id, r]));
          s.agents = new Map(event.data.agents.map((a) => [a.id, a]));
          s.events = event.data.events;
          s.turnedAway = event.data.turnedAway;
          s.connected = true;
          break;
        case 'tick':
          s.clock = event.data.clock;
          s.clockAt = performance.now();
          s.rooms = new Map(event.data.rooms.map((r) => [r.id, r]));
          s.turnedAway = event.data.turnedAway;
          s.connected = true;
          break;
        case 'agents':
          for (const a of event.data) s.agents.set(a.id, a);
          break;
        case 'planb':
          s.events = [event.data, ...s.events].slice(0, 30);
          break;
        case 'door': {
          const r = s.rooms.get(event.data.roomId);
          if (r) s.rooms.set(r.id, { ...r, full: event.data.full || r.seatsOpen === 0, fullSource: event.data.full ? 'door' : r.seatsOpen === 0 ? 'auto' : null });
          break;
        }
      }
      bump();
    });
    return () => {
      close();
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref.current;
}
