// The venue: a stylized three-level convention center. Room geometry is in
// map units (the live map's 1600 × 900 canvas); walking times come from the
// corridor path between two doors, through the escalators or, for step-free
// routes, the elevator.
import roomsData from '../../data/rooms.json';

export type RoomKind = 'keynote' | 'session' | 'quiet' | 'amenity';

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  level: number;
  capacity: number;
  track: string;
  stepFree: boolean;
  note?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ROOMS: Room[] = roomsData as Room[];
export const ROOM_BY_ID = new Map(ROOMS.map((r) => [r.id, r]));
export const SESSION_ROOMS = ROOMS.filter((r) => r.kind === 'session');

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 900;
/** x of the escalators and elevator that connect the levels. */
export const CONNECTOR_X = 800;

/** Corridor centerline for each level, just below that level's rooms. */
export function corridorY(level: number): number {
  return { 1: 850, 2: 560, 3: 270 }[level] ?? 850;
}

/** Where a room's door meets the corridor. */
export function doorPoint(room: Room): { x: number; y: number } {
  return { x: room.x + room.w / 2, y: corridorY(room.level) };
}

const UNITS_PER_MINUTE = 260; // a relaxed conference walk along the corridor
const ESCALATOR_MIN_PER_LEVEL = 0.8;
const ELEVATOR_MIN = 1.6; // waiting for the elevator dominates
const ELEVATOR_MIN_PER_LEVEL = 0.3;
const DOOR_MIN = 0.3;

export interface WalkOptions {
  stepFree?: boolean;
}

/** Waypoints from one room's door to another's, along corridors. */
export function walkPath(from: Room, to: Room): Array<{ x: number; y: number }> {
  const a = doorPoint(from);
  const b = doorPoint(to);
  const inA = { x: a.x, y: from.y + from.h };
  const inB = { x: b.x, y: to.y + to.h };
  if (from.level === to.level) {
    return [inA, a, b, inB];
  }
  return [inA, a, { x: CONNECTOR_X, y: a.y }, { x: CONNECTOR_X, y: b.y }, b, inB];
}

/** Minutes to walk from one room to another. */
export function walkMinutes(from: Room, to: Room, opts: WalkOptions = {}): number {
  if (from.id === to.id) return 0;
  const a = doorPoint(from);
  const b = doorPoint(to);
  let minutes = 2 * DOOR_MIN;
  if (from.level === to.level) {
    minutes += Math.abs(a.x - b.x) / UNITS_PER_MINUTE;
  } else {
    const levels = Math.abs(from.level - to.level);
    minutes += (Math.abs(a.x - CONNECTOR_X) + Math.abs(b.x - CONNECTOR_X)) / UNITS_PER_MINUTE;
    minutes += opts.stepFree
      ? ELEVATOR_MIN + ELEVATOR_MIN_PER_LEVEL * levels
      : ESCALATOR_MIN_PER_LEVEL * levels;
  }
  return Math.round(minutes * 10) / 10;
}
