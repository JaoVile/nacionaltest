'use client';

import { useEffect, useRef, startTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** Intervalo em ms entre refreshes. Default 180_000 (3 min). */
  intervalMs?: number;
  /** Pula refresh quando algum input/textarea está focado (não atrapalha digitação). */
  pauseWhileTyping?: boolean;
}

/**
 * Atualiza dados de RSC em segundo plano via router.refresh().
 * - Imperceptível: usa startTransition; React só repinta o que mudou.
 * - Não consome quando aba está oculta (Page Visibility API).
 * - Catch-up imediato quando a aba volta a ficar visível depois do intervalo.
 * - Opcional: pula tick se o usuário está digitando.
 */
export function AutoRefresh({ intervalMs = 180_000, pauseWhileTyping = true }: Props) {
  const router = useRouter();
  const lastRunRef = useRef<number>(Date.now());

  useEffect(() => {
    let mounted = true;

    const isTyping = () => {
      if (!pauseWhileTyping || typeof document === 'undefined') return false;
      const a = document.activeElement;
      if (!a) return false;
      const tag = a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if ((a as HTMLElement).isContentEditable) return true;
      return false;
    };

    const tick = () => {
      if (!mounted) return;
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      if (isTyping()) return;
      lastRunRef.current = Date.now();
      startTransition(() => router.refresh());
    };

    const id = window.setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible'
          && Date.now() - lastRunRef.current >= intervalMs) {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, intervalMs, pauseWhileTyping]);

  return null;
}
