// The live venue map: rooms in SVG (crisp text, live fill), capybaras on a
// canvas above it (hundreds of sprites at 60 fps). Rooms are nodes, the
// capybaras are pods, and Plan B reschedules draw arcs between rooms.
import { useEffect, useMemo, useRef } from 'react';
import { CONNECTOR_X, MAP_HEIGHT, MAP_WIDTH, ROOMS, ROOM_BY_ID, corridorY, doorPoint, walkPath, type Room } from '../../shared/venue';
import { formatVenueRange } from '../../shared/time';
import type { Talk } from '../../shared/api-types';
import type { AgentView, PlanBEvent, RoomStatus } from '../../shared/live-types';
import { simNow, type LiveState } from '../lib/live';
import { buildSprites, SIT, SPRITE_H, SPRITE_W, type SpriteFrame, type SpriteSheet } from '../lib/sprites';
import { Capy } from './Capy';

interface Props {
  live: LiveState;
  talks: Map<string, Talk>;
  highlightRoom?: string;
}

/** How long a reschedule arc stays on the map, and how many show at once. */
const ARC_MS = 6500;
const MAX_ARCS = 3;

const LEVEL_BANDS: Record<number, [number, number]> = { 3: [22, 292], 2: [312, 582], 1: [602, 872] };

export function fillColor(ratio: number): string {
  if (ratio >= 1) return '#e5604d';
  if (ratio >= 0.85) return '#f29a4a';
  if (ratio >= 0.6) return '#f4c95d';
  return '#7cc6a4';
}

function hash(n: number): number {
  let x = (n + 1) * 2654435761;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function pointAlong(points: Array<{ x: number; y: number }>, t: number) {
  const segs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  let d = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? d / segs[i] : 0;
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: b.x - a.x };
    }
    d -= segs[i];
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, dx: 0 };
}

/** Height of a room's label, in map units. */
const ROOM_HEADER = 66;
/** One capybara on the map stands for this many people (the simulator's group size). */
const PEOPLE_PER_CAPYBARA = 10;
const SEAT_SCALE = 0.8;
const SEAT_W = SPRITE_W * SEAT_SCALE;
const SEAT_H = SPRITE_H * SEAT_SCALE * 0.78;

interface SeatGrid {
  cols: number;
  dx: number;
  dy: number;
  left: number;
}

const seatGrids = new Map<string, SeatGrid>();

/** A seat grid sized for the room's capacity, so a full room looks full. */
function seatGrid(room: Room): SeatGrid {
  const cached = seatGrids.get(room.id);
  if (cached) return cached;
  const seats = Math.max(1, Math.ceil(room.capacity / PEOPLE_PER_CAPYBARA));
  const w = room.w - 20;
  const h = room.h - ROOM_HEADER - 12;
  let best = { cols: 1, rows: seats, fit: 0 };
  for (let cols = 1; cols <= seats; cols++) {
    const rows = Math.ceil(seats / cols);
    const fit = Math.min(w / cols / SEAT_W, h / rows / SEAT_H);
    if (fit > best.fit) best = { cols, rows, fit };
  }
  const dx = Math.min(w / best.cols, SEAT_W * 1.2);
  const grid = { cols: best.cols, dx, dy: Math.min(h / best.rows, SEAT_H * 1.15), left: room.x + 10 + (w - dx * best.cols) / 2 };
  seatGrids.set(room.id, grid);
  return grid;
}

/** Seats fill from the front row (the bottom of the room) up. */
function slotInRoom(room: Room, index: number) {
  const g = seatGrid(room);
  const col = index % g.cols;
  const row = Math.floor(index / g.cols);
  const stagger = (row % 2 ? 1 : -1) * Math.min(g.dx * 0.18, 4);
  return { x: g.left + g.dx * (col + 0.5) + stagger, y: room.y + room.h - 14 - g.dy * (row + 0.5) };
}

/** A point on the quadratic curve a → control → b. */
function curvePoint(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function MapRoom({ room, status, talk, highlight }: { room: Room; status?: RoomStatus; talk?: Talk; highlight: boolean }) {
  const ratio = status ? (status.present + status.held) / status.capacity : 0;
  const fillH = Math.min(1, ratio) * room.h;
  const full = status?.full ?? false;
  return (
    <g className={`map-room ${full ? 'is-full' : ''} ${highlight ? 'is-highlight' : ''}`}>
      <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={18} className="map-room__bg" />
      <clipPath id={`clip-${room.id}`}>
        <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={18} />
      </clipPath>
      <rect
        x={room.x}
        y={room.y + room.h - fillH}
        width={room.w}
        height={fillH}
        fill={fillColor(ratio)}
        opacity={0.28}
        clipPath={`url(#clip-${room.id})`}
        className="map-room__fill"
      />
      <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={18} className="map-room__border" stroke={full ? '#e5604d' : undefined} />
      <foreignObject x={room.x + 8} y={room.y + 9} width={room.w - 16} height={ROOM_HEADER - 11}>
        <div className="map-room__label">
          <div className="map-room__name">
            <span>{room.name.replace('Room ', '')}</span>
            {status && (
              <span className="map-room__count">
                {status.present + status.held}
                <small>/{status.capacity}</small>
              </span>
            )}
          </div>
          <div className="map-room__talk" title={talk?.title}>
            {talk ? talk.title : room.track}
          </div>
        </div>
      </foreignObject>
      {full && (
        <g className="map-room__full">
          <rect x={room.x + room.w - 78} y={room.y - 13} width={66} height={24} rx={12} fill="#e5604d" stroke="#fffaf3" strokeWidth={3} />
          <text x={room.x + room.w - 45} y={room.y + 4} textAnchor="middle" className="map-room__full-text">
            {status?.fullSource === 'door' ? 'CLOSED' : 'FULL'}
          </text>
        </g>
      )}
      {!room.stepFree && (
        <g>
          <rect x={room.x + 12} y={room.y - 11} width={76} height={20} rx={10} fill="#f1e7d8" stroke="#fffaf3" strokeWidth={3} />
          <text x={room.x + 50} y={room.y + 3} textAnchor="middle" className="map-room__note">
            stairs only
          </text>
        </g>
      )}
    </g>
  );
}

function Amenity({ room }: { room: Room }) {
  if (room.id === 'SPRING') {
    return (
      <g className="map-amenity">
        <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={22} fill="#e6f6f3" stroke="#9fd8cf" strokeWidth={2} />
        <ellipse cx={room.x + room.w / 2} cy={room.y + room.h / 2 + 30} rx={room.w / 2 - 22} ry={50} fill="#7fd0c7" opacity={0.75} />
        <ellipse cx={room.x + room.w / 2} cy={room.y + room.h / 2 + 30} rx={room.w / 2 - 48} ry={32} fill="#a9e3dc" opacity={0.7} />
        <foreignObject x={room.x + room.w / 2 - 50} y={room.y + 34} width={100} height={100}>
          <Capy mood="chill" spring size={100} title="Capy relaxing in the Hot Spring quiet room" />
        </foreignObject>
        <text x={room.x + 16} y={room.y + 28} className="map-amenity__name">Hot Spring · quiet room</text>
      </g>
    );
  }
  const icon = room.id === 'YUZU' ? '☕' : room.id === 'LOUNGE' ? '🛋' : '🎤';
  return (
    <g className="map-amenity">
      <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={22} className={room.kind === 'keynote' ? 'map-keynote' : 'map-amenity__bg'} />
      <text x={room.x + 16} y={room.y + 28} className="map-amenity__name">
        {icon} {room.name}
      </text>
      {room.kind === 'keynote' && (
        <text x={room.x + 16} y={room.y + 50} className="map-amenity__sub">
          Keynotes · lunch from 1:00 PM
        </text>
      )}
    </g>
  );
}

export function VenueMap({ live, talks, highlightRoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const sprites = useRef<SpriteSheet | null>(null);
  const arcs = useRef<Array<{ event: PlanBEvent; born: number }>>([]);
  const seen = useRef(new Set<string>());

  // Remember new Plan B events so the canvas can draw their reschedule arcs.
  useEffect(() => {
    for (const e of live.events.slice(0, 5)) {
      const key = `${e.at}-${e.from.roomId}-${e.people}`;
      if (!seen.current.has(key)) {
        seen.current.add(key);
        arcs.current.push({ event: e, born: performance.now() });
      }
    }
  }, [live.events]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    sprites.current ??= buildSprites();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = liveRef.current;
      const scale = canvas.width / MAP_WIDTH;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const now = simNow(s);
      const real = performance.now();
      const calm = reduced.matches;
      const frame: SpriteFrame = calm || Math.floor(real / 170) % 2 === 0 ? 0 : 1;

      // Reschedule arcs: drawn from the full room to each Plan B room, then fading out.
      arcs.current = arcs.current.filter((a) => real - a.born < ARC_MS).slice(-MAX_ARCS);
      for (const { event, born } of arcs.current) {
        const from = ROOM_BY_ID.get(event.from.roomId);
        if (!from) continue;
        const age = real - born;
        const grow = calm ? 1 : 1 - Math.pow(1 - Math.min(1, age / 900), 3);
        const fade = age < ARC_MS * 0.75 ? 1 : 1 - (age - ARC_MS * 0.75) / (ARC_MS * 0.25);
        const a = doorPoint(from);
        for (const p of event.placements) {
          const to = ROOM_BY_ID.get(p.roomId);
          if (!to) continue;
          const b = doorPoint(to);
          const control = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.min(260, 80 + Math.abs(a.x - b.x) * 0.25) };
          const steps = Math.max(2, Math.round(28 * grow));
          const trace = () => {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            for (let i = 1; i <= steps; i++) {
              const q = curvePoint(a, control, b, (i / steps) * grow);
              ctx.lineTo(q.x, q.y);
            }
          };
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255, 250, 243, 0.7)';
          ctx.lineWidth = 9;
          trace();
          ctx.stroke();
          ctx.strokeStyle = '#f6a623';
          ctx.lineWidth = 4.5;
          ctx.setLineDash([15, 11]);
          ctx.lineDashOffset = calm ? 0 : -real / 28;
          trace();
          ctx.stroke();
          ctx.setLineDash([]);
          const tip = curvePoint(a, control, b, grow);
          ctx.fillStyle = '#f6a623';
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
          ctx.fill();
          if (grow >= 1) {
            const text = `+${p.people}`;
            ctx.font = '900 19px Nunito, ui-rounded, system-ui, sans-serif';
            const w = ctx.measureText(text).width + 26;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#f6a623';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(b.x - w / 2, b.y - 50, w, 30, 15);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#7a4a12';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, b.x, b.y - 34);
          }
          ctx.restore();
        }
      }

      // Lay out capybaras: seated in rooms, idle in hallways, queued at doors, walking.
      const byPlace = new Map<string, AgentView[]>();
      const walkers: AgentView[] = [];
      for (const ag of s.agents.values()) {
        if (ag.state === 'walking' && ag.to && ag.depart !== undefined && ag.arrive !== undefined && now >= ag.depart && !calm) {
          walkers.push(ag);
        } else {
          const place = ag.state === 'walking' && calm && ag.to ? ag.to : ag.at;
          const key = `${ag.state === 'waiting' ? 'wait' : 'in'}:${place}`;
          byPlace.set(key, [...(byPlace.get(key) ?? []), ag]);
        }
      }
      const sheet = sprites.current!;
      const stamp = (x: number, y: number, kind: keyof SpriteSheet, f: SpriteFrame, flip: boolean, size = 1) => {
        const img = sheet[kind][f];
        const w = SPRITE_W * size;
        const h = SPRITE_H * size;
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      };

      for (const [key, group] of byPlace) {
        const [kind, place] = key.split(':');
        const room = ROOM_BY_ID.get(place);
        if (!room) continue;
        // Back rows first, so the front row overlaps them.
        group.sort((x, y) => y.id - x.id);
        const last = group.length - 1;
        group.forEach((ag, drawn) => {
          const i = last - drawn;
          const idle = calm ? 0 : Math.sin(real / 650 + ag.id * 1.7) * 0.8;
          if (kind === 'wait') {
            const d = doorPoint(room);
            const angle = Math.PI * (0.15 + 0.7 * hash(ag.id));
            const radius = 26 + (i % 4) * 12;
            const bob = calm ? 0 : Math.sin(real / 140 + ag.id) * 2;
            stamp(d.x + Math.cos(angle) * radius * (i % 2 ? 1 : -1), d.y + 4 + Math.sin(angle) * 10 + bob, 'waiting', 0, i % 2 === 0, 0.95);
          } else if (room.kind === 'session') {
            const p = slotInRoom(room, i);
            stamp(p.x, p.y + idle, ag.rerouted ? 'rerouted' : 'normal', SIT, hash(ag.id + 3) > 0.78, SEAT_SCALE);
          } else {
            const p = {
              x: room.x + 24 + hash(ag.id) * (room.w - 48),
              y: room.y + (room.id === 'SPRING' ? 138 : 64) + hash(ag.id + 99) * (room.h - (room.id === 'SPRING' ? 156 : 84)),
            };
            stamp(p.x, p.y + idle, 'normal', SIT, hash(ag.id + 7) > 0.5, 0.84);
          }
        });
      }

      for (const ag of walkers) {
        const from = ROOM_BY_ID.get(ag.at);
        const to = ROOM_BY_ID.get(ag.to!);
        if (!from || !to) continue;
        const t = (now - ag.depart!) / Math.max(1, ag.arrive! - ag.depart!);
        const p = pointAlong(walkPath(from, to), t);
        const jitter = (hash(ag.id) - 0.5) * 14;
        const hop = frame ? -1.5 : 0;
        stamp(p.x, p.y + jitter - 9 + hop, ag.rerouted ? 'rerouted' : 'normal', frame, p.dx < 0, 0.92);
      }
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const sessionRooms = useMemo(() => ROOMS.filter((r) => r.kind === 'session'), []);
  const others = useMemo(() => ROOMS.filter((r) => r.kind !== 'session'), []);

  return (
    <div className="venue-map">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="venue-map__svg" role="img" aria-label="Live venue map with room occupancy">
        {Object.entries(LEVEL_BANDS).map(([level, [y0, y1]]) => (
          <g key={level}>
            <rect x={14} y={y0} width={MAP_WIDTH - 28} height={y1 - y0} rx={26} className="map-level" />
            <rect x={30} y={corridorY(Number(level)) - 16} width={MAP_WIDTH - 60} height={32} rx={16} className="map-corridor" />
            <text x={MAP_WIDTH - 50} y={corridorY(Number(level)) + 5} textAnchor="end" className="map-level__label">
              Level {level}
            </text>
          </g>
        ))}
        <rect x={CONNECTOR_X - 30} y={250} width={60} height={620} rx={18} className="map-connector" />
        <text x={CONNECTOR_X} y={300} textAnchor="middle" className="map-connector__label">⇅</text>
        <text x={CONNECTOR_X} y={590} textAnchor="middle" className="map-connector__label">⇅</text>
        <text x={CONNECTOR_X} y={330} textAnchor="middle" className="map-connector__sub">escalators</text>
        <text x={CONNECTOR_X} y={620} textAnchor="middle" className="map-connector__sub">+ elevator</text>
        {others.map((r) => (
          <Amenity key={r.id} room={r} />
        ))}
        {sessionRooms.map((r) => {
          const status = live.rooms.get(r.id);
          const talk = status?.currentTalkId ? talks.get(status.currentTalkId) : undefined;
          return <MapRoom key={r.id} room={r} status={status} talk={talk} highlight={highlightRoom === r.id} />;
        })}
      </svg>
      <canvas ref={canvasRef} className="venue-map__canvas" aria-hidden="true" />
    </div>
  );
}

export function talkTime(t: Talk) {
  return formatVenueRange(t.start, t.end);
}
