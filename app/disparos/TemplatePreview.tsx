'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageSquareText } from 'lucide-react';

interface Props {
  linhas: string[];
  values: Record<string, string> | null;
  placa: string | null;
  destinoEfetivo: string | null;
  testMode: boolean;
  current: number;
  total: number;
}

const ease = [0.16, 1, 0.3, 1] as const;
const TYPING_SPEED_MS = 6;

function substituir(linha: string, values: Record<string, string>) {
  return linha
    .replace('{{associação}}', values.associacao || '—')
    .replace('{{cnpj}}',       values.cnpj       || '—')
    .replace('{{placa}}',      values.placa      || '—')
    .replace('{{protocolo}}',  values.protocolo  || '—')
    .replace('{{modelo}}',     values.modelo     || '—')
    .replace('{{valor}}',      values.valor      || '—')
    .replace('{{data}}',       values.data       || '—');
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/**
 * Preview fixo bottom-left com typing-reveal quando o valor muda — simula
 * mensagem sendo digitada no WhatsApp. Reduce-motion pula pro texto completo.
 */
export function TemplatePreview({
  linhas, values, placa, destinoEfetivo, testMode, current, total,
}: Props) {
  const [expandido, setExpandido] = useState(true);
  const reduced = useReducedMotion();
  const fullText = values ? linhas.map((l) => substituir(l, values)).join('\n') : '';
  const [shown, setShown] = useState(fullText);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!fullText) { setShown(''); return; }
    if (reduced) { setShown(fullText); return; }

    setShown('');
    let i = 0;
    let last = performance.now();

    function step(now: number) {
      if (now - last >= TYPING_SPEED_MS) {
        i = Math.min(fullText.length, i + Math.max(1, Math.floor((now - last) / TYPING_SPEED_MS)));
        setShown(fullText.slice(0, i));
        last = now;
      }
      if (i < fullText.length) {
        rafRef.current = requestAnimationFrame(step);
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fullText, reduced]);

  if (!values) return null;

  const typing = shown.length < fullText.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.32, ease }}
        className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] max-w-[360px] sm:w-[360px]
                   shadow-elev-3 rounded-2xl overflow-hidden
                   border border-slate-200 dark:border-ivory-200/10
                   bg-white dark:bg-deep-100"
      >
        <button
          className="w-full px-4 py-3 flex items-center gap-3 text-left
                     hover:bg-slate-50 dark:hover:bg-ivory-200/[0.04] transition-colors"
          onClick={() => setExpandido((v) => !v)}
        >
          <MessageSquareText size={16} className="shrink-0 text-accent dark:text-accent-soft" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-ivory-100 truncate">
              Enviando agora {current && total ? <span className="font-mono tabular-nums text-slate-500 dark:text-ivory-400">({current} de {total})</span> : ''}
            </div>
            <div className="text-xs text-slate-500 dark:text-ivory-400 truncate font-mono">
              {placa ?? '—'} → {destinoEfetivo ?? '—'}
              {testMode && <span className="ml-1 text-amber-500">(teste)</span>}
            </div>
          </div>
          <motion.span animate={{ rotate: expandido ? 0 : 180 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-slate-400 dark:text-ivory-500 shrink-0" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {expandido && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease }}
              className="overflow-hidden border-t border-slate-100 dark:border-ivory-200/[0.05]"
            >
              <div className="p-3 bg-[#e5ddd5] dark:bg-deep-200">
                <div className="bg-white rounded-xl rounded-tl-sm shadow-sm px-3 py-2 text-[12px] text-[#111] leading-relaxed whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
                  {shown}
                  {typing && <span className="inline-block w-[7px] h-[12px] -mb-0.5 ml-0.5 bg-slate-400 animate-pulse-soft align-middle" />}
                  <div className="text-right text-[9px] text-slate-400 mt-1">
                    {typing ? 'digitando…' : 'agora ✓✓'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
