'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { playSfx as play } from '../lib/sfx';

type SfxKind = 'click' | 'success' | 'error' | 'open';

interface SfxCtx {
  enabled: boolean;
  toggle: () => void;
  play: (kind: SfxKind) => void;
}

const Ctx = createContext<SfxCtx | null>(null);
const STORAGE_KEY = 'sfx-enabled';

export function SfxProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === '1') setEnabled(true);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      if (next) play('click');
      return next;
    });
  }, []);

  const fire = useCallback(
    (kind: SfxKind) => { if (enabled) play(kind); },
    [enabled],
  );

  const value = useMemo<SfxCtx>(() => ({ enabled, toggle, play: fire }), [enabled, toggle, fire]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSfx() {
  const c = useContext(Ctx);
  if (!c) return { enabled: false, toggle: () => {}, play: () => {} } as SfxCtx;
  return c;
}
