// Organizer insights with ES|QL over the Plan B events: the demand that full
// rooms turned away, by track and by talk. Nobody could count those people
// before; every Plan B request is one.
import { es } from './es';
import { INDEX } from './es-mappings';
import { currentRunId } from './scheduler';
import { loadData } from './data';
import type { Insights } from '../shared/live-types';

const BY_TRACK = `FROM ${INDEX.planb}
| WHERE runId == ?
| STATS people = SUM(people) BY track
| SORT people DESC
| LIMIT 12`;

const BY_TALK = `FROM ${INDEX.planb}
| WHERE runId == ?
| STATS people = SUM(people) BY fromTalkId
| SORT people DESC
| LIMIT 5`;

const PLACED = `FROM ${INDEX.planb}
| WHERE runId == ?
| STATS people = SUM(people), placed = SUM(placed)`;

type Row = Array<string | number | null>;

async function esql(query: string): Promise<Row[]> {
  const res = (await es.esql.query({ query, params: [currentRunId] })) as unknown as { values: Row[] };
  return res.values ?? [];
}

export async function insights(): Promise<Insights> {
  const [byTrack, byTalk, placed] = await Promise.all([esql(BY_TRACK), esql(BY_TALK), esql(PLACED)]);
  const titles = new Map(loadData().talks.map((t) => [t.id, t.title]));
  const people = Number(placed[0]?.[0] ?? 0);
  const placedPeople = Number(placed[0]?.[1] ?? 0);
  return {
    byTrack: byTrack.map(([p, track]) => ({ track: String(track), people: Number(p) })),
    byTalk: byTalk.map(([p, id]) => ({ talkId: String(id), title: titles.get(String(id)) ?? String(id), people: Number(p) })),
    placedRatio: people ? placedPeople / people : 1,
    esql: [BY_TRACK, BY_TALK, PLACED],
  };
}
