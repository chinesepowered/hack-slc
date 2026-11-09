// Live seat accounting for every room. The invariant the whole app relies on:
//   seatsOpen = capacity - present - held, never negative,
// and nothing (a walk-in, a Plan B hold, a claim) can push present + held
// past capacity. Every method is synchronous, so a read and the hold that
// follows it can't interleave with another request.
import { randomUUID } from 'node:crypto';
import { ROOMS } from '../shared/venue';
import type { RoomStatus, SeatHold } from '../shared/live-types';

interface RoomLive {
  id: string;
  capacity: number;
  present: number;
  held: number;
  doorFull: boolean;
}

interface HoldRecord extends SeatHold {
  source: 'sim' | 'attendee';
}

export class VenueState {
  private rooms = new Map<string, RoomLive>();
  private holds = new Map<string, HoldRecord>();

  constructor() {
    this.reset();
  }

  reset() {
    this.rooms.clear();
    this.holds.clear();
    for (const r of ROOMS) {
      this.rooms.set(r.id, { id: r.id, capacity: r.capacity, present: 0, held: 0, doorFull: false });
    }
  }

  private room(id: string): RoomLive {
    const r = this.rooms.get(id);
    if (!r) throw new Error(`unknown room ${id}`);
    return r;
  }

  seatsOpen(roomId: string): number {
    const r = this.room(roomId);
    return Math.max(0, r.capacity - r.present - r.held);
  }

  /** A room takes nobody new when door staff closed it or it has no open seats. */
  isClosed(roomId: string): boolean {
    return this.room(roomId).doorFull || this.seatsOpen(roomId) === 0;
  }

  /** Walk-in: enters only if there are open seats and the door is open. */
  enter(roomId: string, people: number): boolean {
    const r = this.room(roomId);
    if (r.doorFull || this.seatsOpen(roomId) < people) return false;
    r.present += people;
    return true;
  }

  leave(roomId: string, people: number) {
    const r = this.room(roomId);
    r.present = Math.max(0, r.present - people);
  }

  /** Holds seats for someone on their way. Returns null if they don't fit. */
  hold(roomId: string, talkId: string, people: number, expiresAt: number, source: HoldRecord['source']): SeatHold | null {
    const r = this.room(roomId);
    if (r.doorFull || this.seatsOpen(roomId) < people) return null;
    r.held += people;
    const hold: HoldRecord = { id: randomUUID(), roomId, talkId, people, expiresAt, source };
    this.holds.set(hold.id, hold);
    return { id: hold.id, roomId, talkId, people, expiresAt };
  }

  /** The person arrived: their held seats become occupied seats. */
  claim(holdId: string): boolean {
    const h = this.holds.get(holdId);
    if (!h) return false;
    this.holds.delete(holdId);
    const r = this.room(h.roomId);
    r.held = Math.max(0, r.held - h.people);
    r.present += h.people;
    return true;
  }

  release(holdId: string) {
    const h = this.holds.get(holdId);
    if (!h) return;
    this.holds.delete(holdId);
    const r = this.room(h.roomId);
    r.held = Math.max(0, r.held - h.people);
  }

  /** Every hold expires; returns how many were released. */
  expireHolds(now: number): number {
    let released = 0;
    for (const h of this.holds.values()) {
      if (h.expiresAt <= now) {
        this.release(h.id);
        released++;
      }
    }
    return released;
  }

  getHold(holdId: string): SeatHold | undefined {
    const h = this.holds.get(holdId);
    return h && { id: h.id, roomId: h.roomId, talkId: h.talkId, people: h.people, expiresAt: h.expiresAt };
  }

  setDoorFull(roomId: string, full: boolean) {
    this.room(roomId).doorFull = full;
  }

  /** Empties a room at the end of a talk (keeps holds for the next one). */
  emptyRoom(roomId: string) {
    this.room(roomId).present = 0;
  }

  snapshot(currentTalk: (roomId: string) => string | null): RoomStatus[] {
    return [...this.rooms.values()].map((r) => {
      const seatsOpen = Math.max(0, r.capacity - r.present - r.held);
      const full = r.doorFull || seatsOpen === 0;
      return {
        id: r.id,
        capacity: r.capacity,
        present: r.present,
        held: r.held,
        seatsOpen,
        full,
        fullSource: r.doorFull ? 'door' : full ? 'auto' : null,
        currentTalkId: currentTalk(r.id),
      };
    });
  }
}

export const venue = new VenueState();
