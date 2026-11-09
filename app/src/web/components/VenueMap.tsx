// The live venue map: rooms in SVG (crisp text, live fill), capybaras on a
// canvas above it (hundreds of sprites at 60 fps). Rooms are nodes, the
// capybaras are pods, and Plan B reschedules draw arcs between rooms.
import { useEffect, useMemo, useRef } from 'react';
import { CONNECTOR_X, MAP_HEIGHT, MAP_WIDTH, ROOMS, ROOM_BY_ID, corridorY, doorPoint, walkPath, type Room } from '../../shared/venue';
import { formatVenueRange } from '../../shared/time';
import type { Talk } from '../../shared/api-types';
import type { AgentView, PlanBEvent, RoomStatus } from '../../shared/live-types';
import { simNow, type LiveState } from '../lib/live';
import { buildSprites, SPRITE_H, SPRITE_W, type SpriteSheet } from '../lib/sprites';
import { Capy } from './Capy';

interface Props {
  live: LiveState;
  talks: Map<string, Talk>;
  highlightRoom?: string;
}

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

function slotInRoom(room: Room, index: number, header: number) {
  const pad = 14;
  const cols = Math.max(1, Math.floor((room.w - pad * 2) / 23));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rowsAvailable = Math.max(1, Math.floor((room.h - header - pad) / 19));
  const r = row % rowsAvailable;
  return { x: room.x + pad + col * 23 + (r % 2) * 6, y: room.y + header + r * 19 };
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
      <foreignObject x={room.x + 10} y={room.y + 8} width={room.w - 20} height={78}>
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
          <rect x={room.x + room.w - 70} y={room.y + room.h - 30} width={60} height={22} rx={11} fill="#e5604d" />
          <text x={room.x + room.w - 40} y={room.y + room.h - 15} textAnchor="middle" className="map-room__full-text">
            {status?.fullSource === 'door' ? 'CLOSED' : 'FULL'}
          </text>
        </g>
      )}
      {!room.stepFree && (
        <text x={room.x + 12} y={room.y + room.h - 12} className="map-room__note">
          stairs only
        </text>
      )}
    </g>
  );
}

function Amenity({ room }: { room: Room }) {
  if (room.id === 'SPRING') {
    return (
      <g className="map-amenity">
        <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={22} fill="#e6f6f3" stroke="#9fd8cf" strokeWidth={2} />
        <ellipse cx={room.x + room.w / 2} cy={room.y + room.h / 2 + 18} rx={room.w / 2 - 26} ry={46} fill="#7fd0c7" opacity={0.75} />
        <ellipse cx={room.x + room.w / 2} cy={room.y + room.h / 2 + 18} rx={room.w / 2 - 50} ry={28} fill="#a9e3dc" opacity={0.7} />
        <foreignObject x={room.x + room.w / 2 - 34} y={room.y + 54} width={68} height={68}>
          <Capy mood="chill" spring size={68} title="Capy relaxing in the Hot Spring quiet room" />
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
      const frame = calm ? 0 : Math.floor(real / 170) % 2;

      // Reschedule arcs, fading out over 7 seconds.
      arcs.current = arcs.current.filter((a) => real - a.born < 7000);
      for (const { event, born } of arcs.current) {
        const from = ROOM_BY_ID.get(event.from.roomId);
        if (!from) continue;
        const life = (real - born) / 7000;
        const a = doorPoint(from);
        for (const p of event.placements) {
          const to = ROOM_BY_ID.get(p.roomId);
          if (!to) continue;
          const b = doorPoint(to);
          const midX = (a.x + b.x) / 2;
          const lift = Math.min(260, 80 + Math.abs(a.x - b.x) * 0.25);
          ctx.save();
          ctx.globalAlpha = 1 - life;
          ctx.strokeStyle = '#f6a623';
          ctx.lineWidth = 5;
          ctx.setLineDash([14, 10]);
          ctx.lineDashOffset = calm ? 0 : -real / 30;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.quadraticCurveTo(midX, Math.min(a.y, b.y) - lift, b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#f6a623';
          ctx.beginPath();
          ctx.roundRect(b.x - 30, b.y - 44, 60, 26, 13);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '700 16px Nunito, ui-rounded, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${p.people}`, b.x, b.y - 25);
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
      const stamp = (x: number, y: number, kind: keyof SpriteSheet, f: number, flip: boolean, size = 1) => {
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
        group.sort((x, y) => x.id - y.id);
        group.forEach((ag, i) => {
          if (kind === 'wait') {
            const d = doorPoint(room);
            const angle = Math.PI * (0.15 + 0.7 * hash(ag.id));
            const radius = 26 + (i % 4) * 12;
            const bob = calm ? 0 : Math.sin(real / 140 + ag.id) * 2;
            stamp(d.x + Math.cos(angle) * radius * (i % 2 ? 1 : -1), d.y + 6 + Math.sin(angle) * 10 + bob, 'waiting', 0, i % 2 === 0, 0.9);
          } else if (room.kind === 'session') {
            const p = slotInRoom(room, i, 92);
            stamp(p.x + 12, p.y + 8, ag.rerouted ? 'rerouted' : 'normal', 0, false, 0.62);
          } else {
            const p = {
              x: room.x + 24 + hash(ag.id) * (room.w - 48),
              y: room.y + (room.id === 'SPRING' ? 120 : 64) + hash(ag.id + 99) * (room.h - (room.id === 'SPRING' ? 140 : 84)),
            };
            stamp(p.x, p.y, 'normal', 0, hash(ag.id + 7) > 0.5, 0.7);
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
        stamp(p.x, p.y + jitter - 8, ag.rerouted ? 'rerouted' : 'normal', frame, p.dx < 0, 0.78);
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
