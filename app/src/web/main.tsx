import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, background: '#f6efe4', minHeight: '100vh' }}>
      <h1 style={{ margin: 0 }}>CapyKube</h1>
      <p>A kube-scheduler for humans. Capy is warming up the hot spring.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
