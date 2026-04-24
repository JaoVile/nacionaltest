'use client';

import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { InfoHint } from './components/InfoHint';
import { GLOSSARIO } from './dashboard/glossario';

export interface DiaStats {
  label: string;
  total: number;
  ok: number;
  falha: number;
  queued: number;
}

const ease = [0.16, 1, 0.3, 1] as const;

type Periodo = 'hoje' | '7' | '14';

const PERIODOS: { id: Periodo; label: string; dias: number }[] = [
  { id: 'hoje', label: 'Hoje',    dias: 1 },
  { id: '7',    label: '7 dias',  dias: 7 },
  { id: '14',   label: '14 dias', dias: 14 },
];

export function ChartDisparos({ dias }: { dias: DiaStats[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('14');

  const diasFiltrados = useMemo(() => {
    const n = PERIODOS.find(p => p.id === periodo)?.dias ?? 14;
    return dias.slice(-n);
  }, [dias, periodo]);

  const totais = useMemo(() => {
    const total  = diasFiltrados.reduce((s, d) => s + d.total,  0);
    const ok     = diasFiltrados.reduce((s, d) => s + d.ok,     0);
    const queued = diasFiltrados.reduce((s, d) => s + d.queued, 0);
    const falha  = diasFiltrados.reduce((s, d) => s + d.falha,  0);
    return { total, ok, queued, falha };
  }, [diasFiltrados]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="h-section">Cobranças enviadas</h2>
          <InfoHint label="Cobranças enviadas" side="bottom">
            {GLOSSARIO.disparo}
          </InfoHint>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-deep-50 p-1">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              aria-pressed={periodo === p.id}
              className={`px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wide transition-all
                          ${periodo === p.id
                            ? 'bg-white dark:bg-deep-100 text-slate-900 dark:text-ivory-100 shadow-elev-1'
                            : 'text-slate-500 dark:text-ivory-400 hover:text-slate-900 dark:hover:text-ivory-100'
                          }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {diasFiltrados.length === 0 || totais.total === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center gap-1">
          <span className="text-sm text-slate-600 dark:text-ivory-300">
            Nenhuma cobrança nesse período.
          </span>
          <span className="text-xs text-slate-400 dark:text-ivory-500">
            Use o botão <strong className="font-semibold">Executar agora</strong> para começar.
          </span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex items-end gap-1 h-32 md:h-48 lg:h-56 min-w-[480px]">
              {diasFiltrados.map((d, i) => {
                const maxTotal = Math.max(...diasFiltrados.map(x => x.total), 1);
                const pct = (n: number) => (n / maxTotal) * 100;
                return (
                  <div key={d.label} className="flex-1 flex flex-col justify-end group relative h-full">
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
                      <div className="surface-glass text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-elev-2
                                      text-slate-700 dark:text-ivory-200 font-mono">
                        {d.label}: {d.ok} entregues · {d.queued} aguardando · {d.falha} não entregues
                      </div>
                    </div>
                    <div className="flex flex-col-reverse rounded-t overflow-hidden transition-transform duration-300 ease-out-expo group-hover:-translate-y-0.5">
                      {d.falha > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${pct(d.falha)}%` }}
                          transition={{ duration: 0.7, delay: i * 0.025, ease }}
                          className="bg-rose-400 group-hover:bg-rose-500 transition-colors"
                        />
                      )}
                      {d.queued > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${pct(d.queued)}%` }}
                          transition={{ duration: 0.7, delay: i * 0.025 + 0.08, ease }}
                          className="bg-sky-400 group-hover:bg-sky-500 transition-colors"
                        />
                      )}
                      {d.ok > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${pct(d.ok)}%` }}
                          transition={{ duration: 0.7, delay: i * 0.025 + 0.16, ease }}
                          className="bg-emerald-400 group-hover:bg-emerald-500 transition-colors"
                        />
                      )}
                      {d.total === 0 && <div style={{ height: '2px' }} className="bg-slate-200 dark:bg-ivory-200/15 rounded" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1 min-w-[480px]">
              {diasFiltrados.map((d, i) => (
                <div key={d.label} className={`flex-1 text-center text-[9px] text-slate-400 dark:text-ivory-500 ${diasFiltrados.length > 10 && i % 2 !== 0 ? 'opacity-0' : ''}`}>
                  {d.label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-slate-500 dark:text-ivory-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" aria-hidden />
              Entregues
              <InfoHint label="Entregues" side="top">{GLOSSARIO.entregues}</InfoHint>
              <span className="tabular-nums font-mono">({totais.ok})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-sky-400 inline-block" aria-hidden />
              Aguardando WhatsApp
              <InfoHint label="Aguardando WhatsApp" side="top">{GLOSSARIO.queued}</InfoHint>
              <span className="tabular-nums font-mono">({totais.queued})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-rose-400 inline-block" aria-hidden />
              Não entregues
              <InfoHint label="Não entregues" side="top">{GLOSSARIO.naoEntregues}</InfoHint>
              <span className="tabular-nums font-mono">({totais.falha})</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
