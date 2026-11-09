// The demo clock: the only source of "now" for the scheduler and the
// simulator. It runs a fictional KubeCon day faster than real time and can be
// paused, sped up or moved for a demo.
import type { ClockState } from '../shared/live-types';

/** 10:45 AM MT, Wednesday November 11, 2026. */
export const DAY_START = Date.parse('2026-11-11T17:45:00Z');
/** 5:45 PM MT: the day loops back to the start after this. */
export const DAY_END = Date.parse('2026-11-12T00:45:00Z');

export class SimClock {
  private baseSim: number;
  private baseReal: number;
  private _speed: number;
  private _paused = false;

  constructor(startSim: number, speed: number, private readonly realNow: () => number = Date.now) {
    this.baseSim = startSim;
    this.baseReal = realNow();
    this._speed = speed;
  }

  now(): number {
    if (this._paused) return this.baseSim;
    return this.baseSim + (this.realNow() - this.baseReal) * this._speed;
  }

  get speed() {
    return this._speed;
  }

  get paused() {
    return this._paused;
  }

  private rebase() {
    this.baseSim = this.now();
    this.baseReal = this.realNow();
  }

  set(simMs: number) {
    this.baseSim = simMs;
    this.baseReal = this.realNow();
  }

  setSpeed(speed: number) {
    this.rebase();
    this._speed = Math.min(Math.max(speed, 0.5), 120);
  }

  pause() {
    this.rebase();
    this._paused = true;
  }

  resume() {
    this.baseReal = this.realNow();
    this._paused = false;
  }

  state(): ClockState {
    return { now: Math.round(this.now()), speed: this._speed, paused: this._paused };
  }
}

export const clock = new SimClock(DAY_START, Number(process.env.SIM_SPEED ?? 20));
