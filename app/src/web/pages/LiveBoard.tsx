// The big screen: the venue as a cluster. Capybaras walk to talks, full rooms
// turn red, and Capy reschedules the overflow while organizers watch the
// demand that used to vanish at the door.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Capy } from '../components/Capy';
import { VenueMap } from '../components/VenueMap';
import { ScoreBars } from '../components/ScoreBars';
import { useLive, simNow } from '../lib/live';
import { useTalks } from '../lib/talks';
import { formatVenueDay, formatVenueTime } from '../../shared/time';
import { ROOM_BY_ID } from '../../shared/venue';
import type { CapyMoodResponse, Insights, PlanBPreview } from '../../shared/live-types';

const shortRoom = (id: string) => ROOM_BY_ID.get(id)?.name.replace('Room ', '') ?? id;

export function LiveBoard({ compact = false }: { compact?: boolean }) {
  const live = useLive();
  const talks = useTalks();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [mood, setMood] = useState<CapyMoodResponse | null>(null);
  const [preview, setPreview] = useState<PlanBPreview | null>(null);
  const [showQuery, setShowQuery] = useState(false);
  const params = new URLSearchParams(location.search);
  const controls = params.get('controls') === '1';
  const opsKey = params.get('key') ?? undefined;

  useEffect(() => {
    const load = () => {
      api.insights().then(setInsights, () => undefined);
      api.capyMood().then(setMood, () => undefined);
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // "Under the hood": the scheduler's view of the most recent full room.
  const latest = live.events[0];
  useEffect(() => {
    if (!latest) return;
    api.planB(latest.from.talkId).then(setPreview, () => undefined);
  }, [latest?.from.talkId, latest?.at]);

  const now = simNow(live);
  const seated = useMemo(
    () => [...live.rooms.values()].reduce((s, r) => s + (ROOM_BY_ID.get(r.id)?.kind === 'session' ? r.present : 0), 0),
    [live.version],
  );
  const rescheduled = live.events.reduce((s, e) => s + e.people - e.unplaced, 0);
  const fastest = live.events.length ? Math.round(live.events.slice(0, 10).reduce((s, e) => s + e.latencyMs, 0) / Math.min(10, live.events.length)) : null;
  const capyMood = mood?.mood ?? 'chill';

  return (
    <div className={`board ${compact ? 'board--compact' : ''}`}>
      <header className="board__top">
        <div className="brand">
          <Capy mood={capyMood} spring={capyMood === 'chill'} size={compact ? 64 : 84} />
          <div>
            <h1 className="brand__name">CapyKube</h1>
            <p className="brand__tag">a kube-scheduler for humans</p>
          </div>
        </div>
        <div className="board__clock" aria-live="off">
          <div className="board__time">{live.connected ? formatVenueTime(now) : '…'}</div>
          <div className="board__day">{live.connected ? `${formatVenueDay(now)} · Mountain Time` : 'connecting'}</div>
        </div>
        <dl className="kpis">
          <div className="kpi">
            <dt>In sessions</dt>
            <dd>{seated.toLocaleString()}</dd>
          </div>
          <div className="kpi kpi--warn">
            <dt>Turned away</dt>
            <dd>{live.turnedAway.toLocaleString()}</dd>
          </div>
          <div className="kpi kpi--good">
            <dt>Rescheduled</dt>
            <dd>{rescheduled.toLocaleString()}</dd>
          </div>
          <div className="kpi">
            <dt>Plan B decision</dt>
            <dd>{fastest === null ? '–' : `${fastest} ms`}</dd>
          </div>
        </dl>
      </header>

      <main className="board__main">
        <section className="board__map" aria-label="Venue map">
          <VenueMap live={live} talks={talks} highlightRoom={latest?.from.roomId} />
          <div className="legend" aria-label="Legend">
            <span><i className="legend__capy" /> one capybara = 10 people</span>
            <span><i className="legend__capy legend__capy--yuzu" /> wearing a yuzu = rescheduled by Capy</span>
            <span><i className="legend__wait">!</i> waiting at a full door</span>
            <span className="legend__sim">Simulated crowd · synthetic schedule</span>
          </div>
        </section>

        <aside className="board__side">
          <section className="panel panel--mood">
            <Capy mood={capyMood} size={54} spring={false} />
            <div>
              <h2 className="panel__title">Capy is {capyMood === 'chill' ? 'chilling' : capyMood === 'happy' ? 'happy' : 'worried'}</h2>
              <p className="panel__sub">{mood ? `${mood.source === 'dash0' ? 'Dash0 SLO' : 'Plan B SLO'}: ${mood.detail}` : 'Checking the SLO…'}</p>
            </div>
          </section>

          <section className="panel panel--feed">
            <h2 className="panel__title">Scheduler log</h2>
            {live.events.length === 0 && <p className="panel__empty">No full rooms yet. Capy is soaking.</p>}
            <ol className="feed">
              {live.events.slice(0, compact ? 3 : 4).map((e) => (
                <li key={`${e.at}-${e.from.roomId}-${e.people}-${e.source}`} className={`feed__item feed__item--${e.source}`}>
                  <div className="feed__head">
                    <time>{formatVenueTime(e.at)}</time>
                    <span className="feed__who">{e.source === 'attendee' ? 'attendee app' : e.source === 'door' ? 'door staff' : 'crowd'}</span>
                    <span className="feed__ms">{e.latencyMs} ms</span>
                  </div>
                  <p className="feed__text">
                    <strong>{e.people}</strong> turned away from <strong>{shortRoom(e.from.roomId)}</strong>
                  </p>
                  <div className="feed__moves">
                    {e.placements.map((p) => (
                      <span key={p.talkId} className="chip chip--move">→ {shortRoom(p.roomId)} <b>{p.people}</b></span>
                    ))}
                    {e.unplaced > 0 && <span className="chip chip--warn">{e.unplaced} to the hot spring</span>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {preview && preview.candidates.length > 0 && (
            <section className="panel panel--hood">
              <div className="panel__row">
                <h2 className="panel__title">Under the hood</h2>
                <button className="link-button" onClick={() => setShowQuery((v) => !v)} aria-expanded={showQuery}>
                  {showQuery ? 'Hide query' : 'Elasticsearch query'}
                </button>
              </div>
              <p className="panel__sub">
                Filter + score in one Elasticsearch query · {preview.tookMs} ms · for “{preview.from.title.slice(0, 42)}…”
              </p>
              {showQuery ? (
                <pre className="query">{JSON.stringify(preview.query, null, 1)}</pre>
              ) : (
                <ol className="hood">
                  {preview.candidates.slice(0, 2).map((c) => (
                    <li key={c.talk.id}>
                      <div className="hood__title">
                        <b>{shortRoom(c.roomId)}</b> {c.talk.title}
                      </div>
                      <ScoreBars scores={c.scores} compact />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {insights && insights.byTrack.length > 0 && (
            <section className="panel">
              <h2 className="panel__title">Turned away by track</h2>
              <p className="panel__sub">ES|QL over every Plan B · demand nobody could count before</p>
              <ul className="bars">
                {insights.byTrack.slice(0, compact ? 3 : 5).map((t) => (
                  <li key={t.track}>
                    <span className="bars__label">{t.track}</span>
                    <span className="bars__track">
                      <span className="bars__fill" style={{ width: `${(t.people / insights.byTrack[0].people) * 100}%` }} />
                    </span>
                    <span className="bars__value">{t.people}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </main>

      {controls && (
        <footer className="controls">
          {[
            ['11:30 AM', '2026-11-11T18:30:00Z'],
            ['1:44 PM', '2026-11-11T20:44:00Z'],
            ['3:16 PM', '2026-11-11T22:16:00Z'],
          ].map(([label, at]) => (
            <button key={at} onClick={() => api.setClock({ at }, opsKey)}>
              Jump to {label}
            </button>
          ))}
          {[10, 20, 40].map((s) => (
            <button key={s} onClick={() => api.setClock({ speed: s }, opsKey)}>
              {s}×
            </button>
          ))}
          <button onClick={() => api.setClock({ paused: !live.clock.paused }, opsKey)}>{live.clock.paused ? 'Resume' : 'Pause'}</button>
        </footer>
      )}
    </div>
  );
}
