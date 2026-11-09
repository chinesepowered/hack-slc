import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Talk } from '../../shared/api-types';

/** The whole schedule, loaded once through the paged /api/talks. */
export function useTalks(): Map<string, Talk> {
  const [talks, setTalks] = useState<Map<string, Talk>>(new Map());
  useEffect(() => {
    let cancelled = false;
    api.allTalks().then(
      (list) => !cancelled && setTalks(new Map(list.map((t) => [t.id, t]))),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return talks;
}
