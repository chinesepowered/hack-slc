// Door staff already decide when a room is full. One tap here tells every
// attendee heading there, and points the overflow at a Plan B.
import { api } from '../api';
import { Capy } from '../components/Capy';
import { useLive } from '../lib/live';
import { useTalks } from '../lib/talks';
import { ROOM_BY_ID } from '../../shared/venue';

export function DoorStaff({ roomId }: { roomId: string }) {
  const live = useLive();
  const talks = useTalks();
  const room = ROOM_BY_ID.get(roomId);
  const status = live.rooms.get(roomId);
  if (!room || room.kind !== 'session') return <p className="center">Unknown room.</p>;
  const talk = status?.currentTalkId ? talks.get(status.currentTalkId) : undefined;
  const doorClosed = status?.fullSource === 'door';
  // Door staff open this page from a link that carries the ops key.
  const opsKey = new URLSearchParams(location.search).get('key') ?? undefined;

  return (
    <div className="door">
      <header className="door__head">
        <Capy mood={status?.full ? 'worried' : 'happy'} size={72} />
        <div>
          <p className="door__kicker">Door staff</p>
          <h1 className="door__room">{room.name}</h1>
          <p className="door__talk">{talk?.title ?? 'No talk right now'}</p>
        </div>
      </header>
      <div className="door__count" aria-live="polite">
        <span className="door__num">{status ? status.present + status.held : '–'}</span>
        <span className="door__cap">of {room.capacity} seats</span>
        {status && status.held > 0 && <span className="door__held">{status.held} held for people on their way</span>}
      </div>
      <button
        className={`door__button ${doorClosed ? 'is-closed' : ''}`}
        onClick={() => api.setDoor(room.id, !doorClosed, opsKey)}
        aria-pressed={doorClosed}
      >
        {doorClosed ? 'Reopen the room' : 'Room is full'}
      </button>
      <p className="muted center">
        Closing the door sends everyone headed here to their best Plan B.{' '}
        <a href={`/sign/${room.id}`}>Print the “Room full” sign</a>
      </p>
    </div>
  );
}
