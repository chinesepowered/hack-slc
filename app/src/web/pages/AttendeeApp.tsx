// The attendee's phone: search talks by meaning, keep an agenda, and when a
// room is full, let Capy find a Plan B and hold a seat.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Capy } from '../components/Capy';
import { ScoreBars } from '../components/ScoreBars';
import { fillColor } from '../components/VenueMap';
import { useAgenda } from '../lib/agenda';
import { useLive, simNow } from '../lib/live';
import { useTalks } from '../lib/talks';
import { formatVenueDay, formatVenueRange, formatVenueTime, relativeStart } from '../../shared/time';
import { ROOM_BY_ID } from '../../shared/venue';
import type { SearchResponse, Talk } from '../../shared/api-types';
import { SEARCH_SUGGESTIONS as SUGGESTIONS } from '../../shared/suggestions';
import type { PlanBHoldResponse, PlanBPreview, RoomStatus } from '../../shared/live-types';


type Tab = 'search' | 'now' | 'agenda';

function SeatBar({ status }: { status?: RoomStatus }) {
  if (!status) return null;
  const ratio = Math.min(1, (status.present + status.held) / status.capacity);
  return (
    <div className="seatbar" aria-label={status.full ? 'Room full' : `${status.seatsOpen} seats open`}>
      <span className="seatbar__track">
        <span className="seatbar__fill" style={{ width: `${ratio * 100}%`, background: fillColor(ratio) }} />
      </span>
      <span className={`seatbar__text ${status.full ? 'is-full' : ''}`}>{status.full ? (status.fullSource === 'door' ? 'Door closed' : 'Full') : `${status.seatsOpen} seats`}</span>
    </div>
  );
}

function TalkCard({
  talk,
  status,
  saved,
  onToggle,
  onPlanB,
  meaningOnly,
  now,
}: {
  talk: Talk;
  status?: RoomStatus;
  saved: boolean;
  onToggle: () => void;
  onPlanB: () => void;
  meaningOnly?: boolean;
  now: number;
}) {
  const room = ROOM_BY_ID.get(talk.roomId);
  const live = status && status.currentTalkId === talk.id;
  const ended = Date.parse(talk.end) < now;
  return (
    <article className={`talk ${live && status?.full ? 'talk--full' : ''}`}>
      <div className="talk__meta">
        <span>{formatVenueRange(talk.start, talk.end)}</span>
        <span>·</span>
        <span>{room?.name ?? talk.roomId}</span>
      </div>
      <h3 className="talk__title">{talk.title}</h3>
      <div className="talk__chips">
        <span className="chip">{talk.track}</span>
        <span className="chip chip--soft">{talk.level}</span>
        {talk.captioned && <span className="chip chip--soft">Captioned</span>}
        {meaningOnly && <span className="chip chip--meaning">Found by meaning</span>}
      </div>
      {live && !ended && <SeatBar status={status} />}
      <div className="talk__actions">
        <button className={`btn btn--ghost ${saved ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={saved} aria-label={saved ? 'Remove from my agenda' : 'Add to my agenda'}>
          {saved ? '★ Saved' : '☆ Save'}
        </button>
        {live && status?.full && !ended && (
          <button className="btn btn--primary" onClick={onPlanB}>
            Room full · find my Plan B
          </button>
        )}
      </div>
    </article>
  );
}

function PlanBSheet({ talk, onClose, onSaved }: { talk: Talk; onClose: () => void; onSaved: (t: Talk) => void }) {
  const [quiet, setQuiet] = useState(false);
  const [stepFree, setStepFree] = useState(false);
  const [preview, setPreview] = useState<PlanBPreview | null>(null);
  const [hold, setHold] = useState<(PlanBHoldResponse & { talk: Talk }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore answers to superseded requests when the toggles change quickly.
    let stale = false;
    setPreview(null);
    api.planB(talk.id, { quiet, stepFree }).then(
      (p) => !stale && setPreview(p),
      (e) => !stale && setError(String(e)),
    );
    return () => {
      stale = true;
    };
  }, [talk.id, quiet, stepFree]);

  const best = preview?.candidates[0];
  const take = async (toTalkId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.holdSeat(talk.id, toTalkId, { quiet, stepFree });
      // The server may bind a different room if the chosen one just filled.
      let chosen = preview?.candidates.find((c) => c.talk.id === res.hold.talkId)?.talk;
      if (!chosen) {
        try {
          chosen = await api.talk(res.hold.talkId);
        } catch (e) {
          await api.releaseHold(res.hold.id).catch(() => undefined);
          throw e;
        }
      }
      setHold({ ...res, talk: chosen });
      onSaved(chosen);
    } catch {
      setError('Those seats just went. Capy is looking again.');
      api.planB(talk.id, { quiet, stepFree }).then(setPreview, () => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="planb-title">
      <div className="sheet__card">
        <button className="sheet__close" onClick={onClose} aria-label="Close Plan B">
          ×
        </button>
        <div className="sheet__hero">
          <Capy mood={hold ? 'chill' : 'happy'} spring={!!hold} size={86} />
          <div>
            <p className="sheet__kicker">{ROOM_BY_ID.get(talk.roomId)?.name} is full</p>
            <h2 id="planb-title" className="sheet__title">
              {hold ? 'Your seat is held' : 'Capy found you a Plan B'}
            </h2>
          </div>
        </div>

        {hold ? (
          <div className="hold">
            <p className="hold__talk">{hold.talk.title}</p>
            <p className="hold__where">
              {ROOM_BY_ID.get(hold.hold.roomId)?.name} · {formatVenueRange(hold.talk.start, hold.talk.end)}
            </p>
            <blockquote className="hold__note">“{hold.note}”</blockquote>
            <p className="hold__timer">Seat held until {formatVenueTime(hold.hold.expiresAt)} · added to your agenda</p>
            <button className="btn btn--primary btn--block" onClick={onClose}>
              On my way
            </button>
          </div>
        ) : (
          <>
            <div className="toggles" role="group" aria-label="Plan B preferences">
              <label className="toggle">
                <input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
                <span>Quiet mode · calmer rooms</span>
              </label>
              <label className="toggle">
                <input type="checkbox" checked={stepFree} onChange={(e) => setStepFree(e.target.checked)} />
                <span>Step-free route</span>
              </label>
            </div>
            {!preview && <p className="muted">Capy is checking every room…</p>}
            {preview && !best && <p className="muted">Every similar room is full right now. The Hot Spring quiet room is always open.</p>}
            {best && (
              <article className="pick">
                <p className="pick__room">
                  {best.roomName} · {Math.round(best.walkMinutes)} min walk · {relativeStart(preview!.at, best.talk.start)}
                </p>
                <h3 className="pick__title">{best.talk.title}</h3>
                <p className="pick__seats">{best.seatsOpen} seats open</p>
                <ScoreBars scores={best.scores} />
                <button className="btn btn--primary btn--block" disabled={busy} onClick={() => take(best.talk.id)}>
                  {busy ? 'Holding…' : 'Hold my seat'}
                </button>
              </article>
            )}
            {preview && preview.candidates.length > 1 && (
              <div className="alts">
                <p className="alts__title">Also close</p>
                {preview.candidates.slice(1, 3).map((c) => (
                  <button key={c.talk.id} className="alt" onClick={() => take(c.talk.id)} disabled={busy}>
                    <span className="alt__title">{c.talk.title}</span>
                    <span className="alt__meta">
                      {c.roomName} · {Math.round(c.walkMinutes)} min · score {c.scores.total.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {preview && preview.filtered.length > 0 && (
              <p className="muted small">
                Filtered out: {preview.filtered.map((f) => `${ROOM_BY_ID.get(f.roomId)?.name.replace('Room ', '')} (${f.reason})`).join(', ')}
              </p>
            )}
            {error && <p className="error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export function AttendeeApp() {
  const live = useLive();
  const talks = useTalks();
  const agenda = useAgenda();
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [anyLanguage, setAnyLanguage] = useState(false);
  const [planB, setPlanB] = useState<Talk | null>(null);
  const now = simNow(live);

  // Deep links: /full/<roomId> (the QR code on a Room full sign) and ?planb=<talkId>.
  useEffect(() => {
    const full = location.pathname.match(/^\/full\/([^/]+)/)?.[1];
    const direct = new URLSearchParams(location.search).get('planb');
    if (direct && talks.has(direct)) setPlanB(talks.get(direct)!);
    else if (full && live.rooms.get(full)?.currentTalkId) {
      const t = talks.get(live.rooms.get(full)!.currentTalkId!);
      if (t) setPlanB(t);
    }
  }, [talks.size, live.connected]);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) return;
    setSearching(true);
    try {
      setResults(await api.search(q, 8, anyLanguage));
    } finally {
      setSearching(false);
    }
  };

  const nowAndNext = useMemo(() => {
    const list = [...talks.values()].filter((t) => t.kind === 'session' && Date.parse(t.end) > now);
    const nextStart = Math.min(...list.map((t) => Date.parse(t.start)));
    return list.filter((t) => Date.parse(t.start) === nextStart || (Date.parse(t.start) <= now && Date.parse(t.end) > now)).sort((a, b) => a.roomId.localeCompare(b.roomId));
  }, [talks, Math.floor(now / 60_000)]);

  const mine = agenda.ids.map((id) => talks.get(id)).filter((t): t is Talk => !!t).sort((a, b) => a.start.localeCompare(b.start));

  const card = (t: Talk, meaningOnly?: boolean) => (
    <TalkCard
      key={t.id}
      talk={t}
      status={live.rooms.get(t.roomId)}
      saved={agenda.has(t.id)}
      onToggle={() => agenda.toggle(t.id)}
      onPlanB={() => setPlanB(t)}
      meaningOnly={meaningOnly}
      now={now}
    />
  );

  return (
    <div className="phone-app">
      <header className="app-top">
        <Capy mood="happy" size={46} />
        <div className="app-top__brand">
          <strong>CapyKube</strong>
          <span>{live.connected ? `${formatVenueTime(now)} MT · ${formatVenueDay(now)}` : 'connecting…'}</span>
        </div>
      </header>

      <main className="app-main">
        {tab === 'search' && (
          <section>
            <form
              className="search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                search(query);
              }}
            >
              <label htmlFor="q" className="visually-hidden">
                Search talks
              </label>
              <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What do you want to learn?" autoComplete="off" />
              <button className="btn btn--primary" type="submit" aria-label="Search">
                {searching ? '…' : 'Search'}
              </button>
            </form>
            <label className="toggle toggle--lang">
              <input type="checkbox" checked={anyLanguage} onChange={(e) => setAnyLanguage(e.target.checked)} />
              <span>Ask in any language · Jina on Elastic Cloud</span>
            </label>
            {!results && (
              <div className="suggest">
                <p className="muted">Try asking in your own words:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip chip--button" onClick={() => search(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {results && (
              <div className="results">
                <p className="muted small">
                  {results.hits.length} talks ·{' '}
                  {results.mode === 'multilingual'
                    ? 'any language (Jina embeddings + reranker, Elastic Cloud)'
                    : results.mode === 'hybrid'
                      ? 'keywords + meaning (Elasticsearch RRF)'
                      : 'keywords'}{' '}
                  · {results.tookMs} ms
                </p>
                {results.hits.map((h) => card(h.talk, results.mode !== 'multilingual' && !h.titleOverlap))}
              </div>
            )}
          </section>
        )}

        {tab === 'now' && (
          <section className="results">
            <h2 className="section-title">Now and next</h2>
            {nowAndNext.map((t) => card(t))}
          </section>
        )}

        {tab === 'agenda' && (
          <section className="results">
            <h2 className="section-title">My agenda</h2>
            {mine.length === 0 && <p className="muted">Star talks to plan your day. Capy watches the rooms for you.</p>}
            {mine.map((t) => card(t))}
          </section>
        )}
      </main>

      <nav className="tabs" aria-label="Sections">
        {(
          [
            ['search', 'Search'],
            ['now', 'Now'],
            ['agenda', `Agenda${agenda.ids.length ? ` (${agenda.ids.length})` : ''}`],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} className={`tabs__tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
            {label}
          </button>
        ))}
      </nav>

      {planB && <PlanBSheet talk={planB} onClose={() => setPlanB(null)} onSaved={(t) => agenda.add(t.id)} />}
    </div>
  );
}
