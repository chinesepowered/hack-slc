// "My agenda" lives in the browser: a list of talk ids. Wrapped in try/catch
// because storage can be blocked (private windows, embedded previews).
import { useCallback, useEffect, useState } from 'react';

const KEY = 'capykube.agenda';

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function useAgenda() {
  const [ids, setIds] = useState<string[]>(read);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable: the agenda lasts for this visit only */
    }
  }, [ids]);
  const toggle = useCallback((id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])), []);
  const add = useCallback((id: string) => setIds((cur) => (cur.includes(id) ? cur : [...cur, id])), []);
  return { ids, toggle, add, has: (id: string) => ids.includes(id) };
}
