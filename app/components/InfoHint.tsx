'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Side = 'top' | 'bottom';

interface Props {
  label: string;
  children: React.ReactNode;
  side?: Side;
  className?: string;
}

interface Coords {
  top: number;
  left: number;
  effectiveSide: Side;
  arrowLeft: number; // px relativo ao tooltip pra apontar pro botão
}

const TOOLTIP_W = 256;
const TOOLTIP_GAP = 8;
const VIEWPORT_PAD = 8;

export function InfoHint({ label, children, side = 'bottom', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fechar com clique fora / Esc
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (tipRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Recalcular posição quando abrir, em scroll, resize
  useLayoutEffect(() => {
    if (!open) return;

    function update() {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const desiredW = Math.min(TOOLTIP_W, vw - VIEWPORT_PAD * 2);
      const tipH = tipRef.current?.offsetHeight ?? 120;

      // Decidir side: começa pelo pedido, mas flipa se não couber
      let effectiveSide: Side = side;
      const spaceBelow = vh - rect.bottom - TOOLTIP_GAP - VIEWPORT_PAD;
      const spaceAbove = rect.top - TOOLTIP_GAP - VIEWPORT_PAD;
      if (effectiveSide === 'bottom' && spaceBelow < tipH && spaceAbove > spaceBelow) {
        effectiveSide = 'top';
      } else if (effectiveSide === 'top' && spaceAbove < tipH && spaceBelow > spaceAbove) {
        effectiveSide = 'bottom';
      }

      const top =
        effectiveSide === 'bottom'
          ? rect.bottom + TOOLTIP_GAP
          : rect.top - tipH - TOOLTIP_GAP;

      const btnCenter = rect.left + rect.width / 2;
      let left = btnCenter - desiredW / 2;
      const minLeft = VIEWPORT_PAD;
      const maxLeft = vw - desiredW - VIEWPORT_PAD;
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;

      const arrowLeft = Math.max(12, Math.min(desiredW - 12, btnCenter - left));

      setCoords({ top, left, effectiveSide, arrowLeft });
    }

    update();
    // segundo update após paint pra pegar offsetHeight real do tooltip
    const raf = requestAnimationFrame(update);

    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, side]);

  const desiredW =
    typeof window !== 'undefined'
      ? Math.min(TOOLTIP_W, window.innerWidth - VIEWPORT_PAD * 2)
      : TOOLTIP_W;

  return (
    <span ref={wrapRef} className={`relative inline-flex items-center ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Saiba mais: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
                   text-slate-400 hover:text-accent hover:bg-accent/10
                   dark:text-ivory-500 dark:hover:text-accent-soft
                   transition-colors duration-150 focus:outline-none
                   focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Info className="w-3 h-3" aria-hidden="true" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tipRef}
                id={id}
                role="tooltip"
                initial={{ opacity: 0, y: coords?.effectiveSide === 'top' ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: coords?.effectiveSide === 'top' ? 4 : -4 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'fixed',
                  top: coords?.top ?? -9999,
                  left: coords?.left ?? -9999,
                  width: desiredW,
                  zIndex: 9999,
                  visibility: coords ? 'visible' : 'hidden',
                }}
                className="rounded-xl border border-slate-200 bg-white p-3
                           shadow-elev-3 text-xs leading-relaxed text-slate-700
                           dark:border-ivory-200/10 dark:bg-deep-100 dark:text-ivory-200"
              >
                <strong className="block font-sans font-semibold text-slate-900 dark:text-ivory-100 mb-1">
                  {label}
                </strong>
                <span className="font-sans">{children}</span>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
