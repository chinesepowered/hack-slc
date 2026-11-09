// The printable sign for a full room. Its QR code opens the attendee app on
// this room's Plan B: no app to install, right when people need it.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Capy } from '../components/Capy';
import { ROOM_BY_ID } from '../../shared/venue';

export function RoomSign({ roomId }: { roomId: string }) {
  const room = ROOM_BY_ID.get(roomId);
  const [svg, setSvg] = useState('');
  const url = `${location.origin}/full/${encodeURIComponent(roomId)}`;
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#3a2719', light: '#ffffff' } }).then(setSvg, () => undefined);
  }, [url]);
  if (!room) return <p className="center">Unknown room.</p>;
  return (
    <div className="sign">
      <Capy mood="worried" size={180} />
      <h1 className="sign__title">This room is full</h1>
      <p className="sign__room">{room.name}</p>
      <div className="sign__qr" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="sign__cta">Scan for your Plan B</p>
      <p className="sign__sub">Capy finds the closest talk on the same topic with free seats, and holds one for you.</p>
      <p className="sign__brand">CapyKube · a kube-scheduler for humans</p>
    </div>
  );
}
