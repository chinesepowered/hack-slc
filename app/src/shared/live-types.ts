// Shapes for the live parts of the API: the venue's state, the Plan B
// scheduler, and the server-sent event stream.
import type { ScoreBreakdown } from './scoring';
import type { Talk } from './api-types';

export interface ClockState {
  /** Simulated conference time, epoch ms (UTC). */
  now: number;
  speed: number;
  paused: boolean;
}

export interface RoomStatus {
  id: string;
  capacity: number;
  present: number;
  held: number;
  seatsOpen: number;
  full: boolean;
  fullSource: 'auto' | 'door' | null;
  currentTalkId: string | null;
}

export type AgentState = 'idle' | 'walking' | 'seated' | 'waiting';

/** One capybara on the map: a group of attendees moving together. */
export interface AgentView {
  id: number;
  people: number;
  state: AgentState;
  /** Where the agent is, or where it's walking from. */
  at: string;
  to?: string;
  /** Sim epoch ms. */
  depart?: number;
  arrive?: number;
  /** True while walking to a Plan B room. */
  rerouted?: boolean;
}

export interface PlanBCandidate {
  talk: Talk;
  roomId: string;
  roomName: string;
  walkMinutes: number;
  seatsOpen: number;
  startsInMinutes: number;
  scores: ScoreBreakdown;
}

export interface PlanBPreview {
  from: Talk;
  fromRoomName: string;
  quiet: boolean;
  stepFree: boolean;
  candidates: PlanBCandidate[];
  /** Rooms the Filter phase removed, and why. */
  filtered: Array<{ roomId: string; reason: string }>;
  /** The Elasticsearch request, with the query vector shortened, for the "under the hood" view. */
  query: unknown;
  tookMs: number;
  /** Sim time the scheduler planned for. */
  at: number;
}

export interface SeatHold {
  id: string;
  roomId: string;
  talkId: string;
  people: number;
  /** Sim epoch ms. */
  expiresAt: number;
}

export interface PlanBHoldResponse {
  hold: SeatHold;
  note: string;
}

export interface PlanBEvent {
  at: number;
  source: 'sim' | 'attendee' | 'door';
  from: { talkId: string; title: string; roomId: string };
  people: number;
  placements: Array<{ talkId: string; title: string; roomId: string; people: number; score: number }>;
  unplaced: number;
  latencyMs: number;
}

export interface LiveSnapshot {
  clock: ClockState;
  rooms: RoomStatus[];
  agents: AgentView[];
  events: PlanBEvent[];
  turnedAway: number;
}

export interface Insights {
  byTrack: Array<{ track: string; people: number }>;
  byTalk: Array<{ talkId: string; title: string; people: number }>;
  placedRatio: number;
  esql: string[];
}

export type StreamEvent =
  | { type: 'snapshot'; data: LiveSnapshot }
  | { type: 'tick'; data: { clock: ClockState; rooms: RoomStatus[]; turnedAway: number } }
  | { type: 'agents'; data: AgentView[] }
  | { type: 'planb'; data: PlanBEvent }
  | { type: 'door'; data: { roomId: string; full: boolean } };
