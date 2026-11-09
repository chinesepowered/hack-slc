import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { init as initDash0 } from '@dash0/sdk-web';
import { AttendeeApp } from './pages/AttendeeApp';
import { LiveBoard } from './pages/LiveBoard';
import { DoorStaff } from './pages/DoorStaff';
import { RoomSign } from './pages/RoomSign';
import { DemoStage } from './pages/DemoStage';
import './styles.css';

// Real-user monitoring. The server's /rum proxy adds the Dash0 token, so no
// token ships to the browser; same-origin API calls carry trace context, so
// a click in the browser and the Elasticsearch query it causes share a trace.
initDash0({
  serviceName: 'capykube-web',
  endpoint: { url: `${location.origin}/rum`, authToken: 'set-by-proxy' },
});

function route() {
  const path = location.pathname;
  const door = path.match(/^\/door\/([^/]+)/);
  const sign = path.match(/^\/sign\/([^/]+)/);
  if (path.startsWith('/live')) return <LiveBoard />;
  if (path.startsWith('/demo')) return <DemoStage />;
  if (door) return <DoorStaff roomId={decodeURIComponent(door[1])} />;
  if (sign) return <RoomSign roomId={decodeURIComponent(sign[1])} />;
  return <AttendeeApp />;
}

createRoot(document.getElementById('root')!).render(<StrictMode>{route()}</StrictMode>);
