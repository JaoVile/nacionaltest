'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, ChevronDown, X, FileText, Ban, Clock, TestTube2 } from 'lucide-react';
import { DisparoDetailDrawer } from '../components/DisparoDetailDrawer';
import { statusAtomosHumano } from '../dashboard/glossario';

export interface LiveEvento {
  type: 'sending' | 'result' | 'testing' | 'test-result';
  current: number;
  total: number;
  placa: string;
  modelo: string;
  ok?: boolean;
  status?: string | null;
  failureReason?: string | null;
  error?: string | null;
  elapsedMs?: number;
  destinoReal?: string;
  destinoEfetivo?: string;
  testMode?: boolean;
  httpStatus?: number | null;
  atomosMessageId?: string | null;
  atomosSessionId?: string | null;
  disparoId?: string;
  atendimentoId?: string;
  templateId?: string;
  values?: Record<string, string>;
  request?: unknown;
  response?: unknown;
  statusCheck?: unknown;
}

export interface LiveEstado {
  fase: 'idle' | 'sending' | 'testing' | 'countdown' | 'done' | 'error' | 'canceled' | 'aborted';
  total: number;
  current: number;
  eventos: LiveEvento[];
  fatalMsg?: string;
  abortMsg?: string;
  countdown?: { remaining: number; total: number };
}

interface Props {
  estado: LiveEstado;
  onClose: () => void;
  onCancel?: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

function jsonPretty(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export function DisparoLive({ estado, onClose, onCancel }: Props) {
  const [expandido, setExpandido] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  function toggleEvento(i: number) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  useEffect(() => {
    if (logRef.current && expandido) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [estado.eventos.length, expandido]);

  const visible = estado.fase !== 'idle';
  const pct = estado.total > 0 ? Math.round((estado.current / estado.total) * 100) : 0;
  const ativo = estado.fase === 'sending' || estado.fase === 'testing' || estado.fase === 'countdown';
  const concluido = estado.fase === 'done';
  const cancelado = estado.fase === 'canceled' || estado.fase === 'aborted';
  const cancelavel = ativo || estado.fase === 'countdown';
  const resultados = estado.eventos.filter((e) => e.type === 'result');
  const ok = resultados.filter((e) => e.ok).length;
  const falhas = resultados.filter((e) => !e.ok).length;
  const ultimo = estado.eventos[estado.eventos.length - 1];

  const statusLabel =
    estado.fase === 'testing' ? 'Enviando teste de segurança…'
    : estado.fase === 'countdown' ? `Teste deu certo — enviando os reais em ${estado.countdown?.remaining ?? 0}s`
    : estado.fase === 'sending' ? `Enviando ${estado.current} de ${estado.total}…`
    : estado.fase === 'canceled' ? 'Cancelado por você'
    : estado.fase === 'aborted' ? 'Cancelamos porque o teste falhou'
    : concluido ? `Pronto — ${ok} entregue${ok === 1 ? '' : 's'}${falhas > 0 ? `, ${falhas} não entregue${falhas === 1 ? '' : 's'}` : ''}`
    : 'Algo deu errado';

  const progressColor =
    estado.fase === 'testing' || estado.fase === 'countdown' ? 'bg-amber-500'
    : ativo                                                  ? 'bg-accent dark:bg-accent-soft'
    : concluido && falhas === 0                              ? 'bg-emerald-500'
    : concluido                                              ? 'bg-amber-500'
    : cancelado                                              ? 'bg-amber-500'
    :                                                          'bg-rose-500';

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.32, ease }}
            className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-[360px] sm:w-[360px]
                       shadow-elev-3 rounded-2xl overflow-hidden
                       border border-slate-200 dark:border-ivory-200/10
                       bg-white dark:bg-deep-100"
          >
            <button
              className="w-full px-4 py-3 flex items-center gap-3 text-left
                         hover:bg-slate-50 dark:hover:bg-ivory-200/[0.04] transition-colors"
              onClick={() => setExpandido((v) => !v)}
            >
              <span className="shrink-0">
                {estado.fase === 'testing'  ? <TestTube2 size={16} className="text-amber-500 animate-pulse" />
               : estado.fase === 'countdown' ? <Clock size={16} className="text-accent dark:text-accent-soft" />
               : ativo                        ? <Loader2 size={16} className="text-accent dark:text-accent-soft animate-spin" />
               : concluido
                  ? (falhas === 0 ? <CheckCircle size={16} className="text-emerald-500" />
                                  : <XCircle size={16} className="text-rose-500" />)
               : cancelado ? <Ban size={16} className="text-amber-500" />
               :              <XCircle size={16} className="text-rose-500" />}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-ivory-100 truncate">{statusLabel}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-ivory-500 shrink-0">{pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-deep-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${progressColor} ${ativo ? 'relative overflow-hidden' : ''}`}
                    initial={false}
                    animate={{
                      width: estado.fase === 'countdown' && estado.countdown
                        ? `${((estado.countdown.total - estado.countdown.remaining) / estado.countdown.total) * 100}%`
                        : `${pct}%`,
                    }}
                    transition={{ duration: 0.5, ease }}
                  >
                    {ativo && (
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    )}
                  </motion.div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">
                <motion.span animate={{ rotate: expandido ? 0 : 180 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={14} className="text-slate-400 dark:text-ivory-500" />
                </motion.span>
                {!ativo && !cancelavel && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="ml-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-ivory-200/10
                               text-slate-400 dark:text-ivory-500 hover:text-slate-600 dark:hover:text-ivory-200"
                    title="Fechar"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </button>

            {cancelavel && onCancel && (
              <div className="px-3 pb-3 -mt-1 flex justify-end border-b border-slate-100 dark:border-ivory-200/[0.05]">
                <button
                  onClick={onCancel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500 text-white text-xs font-semibold
                             hover:bg-rose-600 transition-colors"
                >
                  <Ban size={12} /> Cancelar envios
                </button>
              </div>
            )}

            {cancelado && estado.abortMsg && (
              <div className="px-3 pb-3 pt-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10
                              border-t border-amber-200 dark:border-amber-500/25">
                {estado.abortMsg}
              </div>
            )}

            <AnimatePresence initial={false}>
              {expandido && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="overflow-hidden border-t border-slate-100 dark:border-ivory-200/[0.05]"
                >
                  {resultados.length > 0 && (
                    <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-ivory-200/[0.05] text-center py-2">
                      <div>
                        <div className="text-[0.55rem] font-mono uppercase tracking-widest text-slate-400 dark:text-ivory-500">total</div>
                        <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-ivory-100">{estado.total}</div>
                      </div>
                      <div>
                        <div className="text-[0.55rem] font-mono uppercase tracking-widest text-slate-400 dark:text-ivory-500">entregues</div>
                        <div className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{ok}</div>
                      </div>
                      <div>
                        <div className="text-[0.55rem] font-mono uppercase tracking-widest text-slate-400 dark:text-ivory-500">não entregues</div>
                        <div className={`text-sm font-semibold tabular-nums ${falhas > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-ivory-500'}`}>{falhas}</div>
                      </div>
                    </div>
                  )}

                  <div ref={logRef} className="max-h-96 overflow-y-auto px-3 py-2 space-y-0.5">
                    {estado.eventos.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-ivory-500 py-2 text-center">Aguardando início…</p>
                    )}
                    <AnimatePresence initial={false}>
                      {estado.eventos.map((ev, i) => {
                        const aberto = expandidos.has(i);
                        const clicavel = ev.type === 'result';
                        return (
                          <motion.div
                            key={`${ev.placa}-${ev.type}-${i}`}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.25, ease }}
                            className="text-xs"
                          >
                            <div
                              className={`flex items-center gap-2 py-0.5 rounded px-1 ${
                                clicavel ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-ivory-200/[0.04]' : ''
                              }`}
                              onClick={() => clicavel && toggleEvento(i)}
                            >
                              {ev.type === 'sending'
                                ? <Loader2 size={11} className="shrink-0 text-accent dark:text-accent-soft animate-spin" />
                                : ev.ok
                                  ? <CheckCircle size={11} className="shrink-0 text-emerald-500" />
                                  : <XCircle size={11} className="shrink-0 text-rose-500" />}
                              <span className="font-mono text-slate-700 dark:text-ivory-200 w-20 shrink-0">{ev.placa}</span>
                              <span className="text-slate-400 dark:text-ivory-500 truncate flex-1">{ev.modelo}</span>
                              {ev.type === 'result' && ev.status && (() => {
                                const h = statusAtomosHumano(ev.status);
                                const color =
                                  h.tone === 'ok'   ? 'text-emerald-600 dark:text-emerald-400'
                                  : h.tone === 'fail' ? 'text-rose-500 dark:text-rose-400'
                                  :                    'text-amber-600 dark:text-amber-400';
                                return (
                                  <span className={`shrink-0 text-[10px] font-semibold ${color}`} title={`Status Atomos: ${ev.status}`}>
                                    {h.label}
                                  </span>
                                );
                              })()}
                              {ev.type === 'result' && ev.elapsedMs != null && (
                                <span className="shrink-0 text-slate-400 dark:text-ivory-500 text-[10px] font-mono tabular-nums">
                                  {(ev.elapsedMs / 1000).toFixed(1)}s
                                </span>
                              )}
                              {ev.type === 'sending' && (
                                <span className="shrink-0 text-slate-400 dark:text-ivory-500 text-[10px]">enviando…</span>
                              )}
                              {clicavel && (
                                <motion.span animate={{ rotate: aberto ? 0 : 180 }} transition={{ duration: 0.2 }}>
                                  <ChevronDown size={10} className="shrink-0 text-slate-400 dark:text-ivory-500" />
                                </motion.span>
                              )}
                            </div>

                            <AnimatePresence initial={false}>
                              {clicavel && aberto && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-1 ml-4 mb-1.5 space-y-1.5 border-l border-slate-200 dark:border-ivory-200/10 pl-2">
                                    <div className="text-[10px] text-slate-500 dark:text-ivory-400 space-y-0.5">
                                      {ev.destinoEfetivo && (
                                        <div>
                                          <span className="text-slate-700 dark:text-ivory-200">Enviada para:</span>{' '}
                                          <span className="font-mono">{ev.destinoEfetivo}</span>
                                          {ev.testMode && <span className="ml-1 text-amber-600 dark:text-amber-400">(teste)</span>}
                                        </div>
                                      )}
                                      {ev.atomosMessageId && (
                                        <div className="break-all">
                                          <span className="text-slate-700 dark:text-ivory-200">ID da mensagem:</span>{' '}
                                          <span className="font-mono">{ev.atomosMessageId}</span>
                                        </div>
                                      )}
                                      {ev.failureReason && (
                                        <div className="text-rose-500 dark:text-rose-400 break-words">
                                          <span className="font-semibold">Motivo:</span> {ev.failureReason}
                                        </div>
                                      )}
                                      {ev.error && (
                                        <div className="text-rose-500 dark:text-rose-400 break-words">
                                          <span className="font-semibold">Erro:</span> {ev.error}
                                        </div>
                                      )}
                                    </div>

                                    {ev.disparoId && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setDrawerId(ev.disparoId ?? null); }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold
                                                   bg-accent/10 text-accent hover:bg-accent/20
                                                   dark:bg-accent-deep/20 dark:text-accent-soft dark:hover:bg-accent-deep/30"
                                      >
                                        <FileText size={10} /> Ver detalhes
                                      </button>
                                    )}

                                    {(ev.request != null || ev.response != null) && (
                                      <details className="text-[10px]">
                                        <summary className="cursor-pointer text-slate-500 dark:text-ivory-400 select-none">
                                          Dados técnicos (para o admin)
                                          {ev.httpStatus != null && <span className="ml-2 font-mono text-slate-400 dark:text-ivory-500">http {ev.httpStatus}</span>}
                                        </summary>
                                        {ev.request != null && (
                                          <pre className="mt-1 bg-slate-900 dark:bg-black text-ivory-100 rounded p-1.5 overflow-x-auto max-h-32 text-[10px] leading-tight">
                                            {'// request\n' + jsonPretty(ev.request)}
                                          </pre>
                                        )}
                                        {ev.response != null && (
                                          <pre className="mt-1 bg-slate-900 dark:bg-black text-ivory-100 rounded p-1.5 overflow-x-auto max-h-32 text-[10px] leading-tight">
                                            {'// response\n' + jsonPretty(ev.response)}
                                          </pre>
                                        )}
                                        {ev.statusCheck != null && (
                                          <pre className="mt-1 bg-slate-900 dark:bg-black text-ivory-100 rounded p-1.5 overflow-x-auto max-h-32 text-[10px] leading-tight">
                                            {'// statusCheck\n' + jsonPretty(ev.statusCheck)}
                                          </pre>
                                        )}
                                      </details>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {ativo && ultimo && (
                    <div className="px-3 pb-2 text-[11px] text-slate-400 dark:text-ivory-500 font-mono truncate border-t border-slate-50 dark:border-ivory-200/[0.03] pt-1">
                      → {ultimo.destinoEfetivo ?? ultimo.placa}
                    </div>
                  )}
                  {estado.fase === 'error' && estado.fatalMsg && (
                    <div className="px-3 pb-3 text-xs text-rose-600 dark:text-rose-400">{estado.fatalMsg}</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <DisparoDetailDrawer disparoId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  );
}
