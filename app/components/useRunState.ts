'use client';

import { useEffect, useState } from 'react';

export interface RunStateClient {
  running: boolean;
  current: number;
  total: number;
  startedAt: string | null;
  label: string | null;
}

const IDLE: RunStateClient = { running: false, current: 0, total: 0, startedAt: null, label: null };

export function useRunState(intervalMs = 4000) {
  const [state, setState] = useState<RunStateClient>(IDLE);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch('/api/run/status', { cache: 'no-store' });
        if (!r.ok) throw new Error('status');
        const data = (await r.json()) as RunStateClient;
        if (alive) setState(data);
      } catch {
        if (alive) setState(IDLE);
      } finally {
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    }

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return state;
}
