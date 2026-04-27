'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarClock, Clock, Play, Save, Sparkles, ListChecks, Zap } from 'lucide-react';
import { useFeedbackAction } from '../components/useFeedbackAction';
import { InfoHint } from '../components/InfoHint';
import { ResumoPainel, type ResumoFiltros, aplicarFiltrosResumo } from '../components/ResumoPainel';
import type { ItemResumo } from '../../lib/resumo-types';

interface AtendimentoOption {
  id: string;
  placa: string;
  modelo: string;
  valor: number;
  valorFmt: string;
  dataFmt: string;
  dataISO: string;
  prestador: string;
  associacao: string;
  cnpj: string;
  telefone: string;
}

interface InitialState {
  ativo: boolean;
  modo: 'massa' | 'selecionados';
  diasSemana: number[];
  hora: number;
  minuto: number;
  placas: string[];
  cronExpr: string;
  proximaExec: string | null;
  ultimaExec: string | null;
  ultimoTotal: number | null;
  ultimoOk: number | null;
  ultimoFalha: number | null;
  ultimoErro: string | null;
}

interface Props {
  initial: InitialState;
  atendimentos: AtendimentoOption[];
}

const DIAS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

export function AgendamentoClient({ initial, atendimentos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [ativo, setAtivo]           = useState(initial.ativo);
  const [modo, setModo]             = useState<'massa' | 'selecionados'>(initial.modo);
  const [dias, setDias]             = useState<Set<number>>(new Set(initial.diasSemana));
  const [hora, setHora]             = useState(initial.hora);
  const [minuto, setMinuto]         = useState(initial.minuto);
  const [placas, setPlacas]         = useState<Set<string>>(new Set(initial.placas));
  const [busca, setBusca]           = useState('');
  const [resumoFiltros, setResumoFiltros] = useState<ResumoFiltros>({ prestadores: [], associacoes: [], cnpjs: [] });

  const dirty = useMemo(() => {
    if (ativo  !== initial.ativo)  return true;
    if (modo   !== initial.modo)   return true;
    if (hora   !== initial.hora)   return true;
    if (minuto !== initial.minuto) return true;
    const initSet = new Set(initial.diasSemana);
    if (initSet.size !== dias.size) return true;
    for (const d of dias) if (!initSet.has(d)) return true;
    const initPlacas = new Set(initial.placas);
    if (initPlacas.size !== placas.size) return true;
    for (const p of placas) if (!initPlacas.has(p)) return true;
    return false;
  }, [ativo, modo, dias, hora, minuto, placas, initial]);

  function toggleDia(id: number) {
    setDias((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePlaca(id: string) {
    setPlacas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const atendimentosFiltrados = useMemo(() => {
    const aposResumo = aplicarFiltrosResumo(
      atendimentos.map((a) => ({ ...a, dataAtendimento: a.dataISO, telefone: a.telefone, status: undefined })),
      resumoFiltros,
    );
    const q = busca.trim().toLowerCase();
    if (!q) return aposResumo as typeof atendimentos;
    return (aposResumo as typeof atendimentos).filter((a) =>
      [a.placa, a.modelo, a.prestador].some((c) => c.toLowerCase().includes(q)),
    );
  }, [atendimentos, busca, resumoFiltros]);

  const itensResumo = useMemo<ItemResumo[]>(() => atendimentos.map((a) => ({
    id: a.id,
    placa: a.placa,
    prestador: a.prestador || '',
    associacao: a.associacao || '',
    cnpj: a.cnpj || '',
    valor: a.valor,
    valorFmt: a.valorFmt,
    telefone: a.telefone,
    dataAtendimento: a.dataISO,
    dataFmt: a.dataFmt,
  })), [atendimentos]);

  const salvar = useFeedbackAction(
    {
      loading: 'Salvando agendamento…',
      success: 'Agendamento salvo',
      error: 'Falha ao salvar',
    },
    async () => {
      const payload = {
        ativo,
        modo,
        diasSemana: Array.from(dias).sort(),
        hora,
        minuto,
        placas: Array.from(placas),
      };
      const res = await fetch('/api/agendamento', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      startTransition(() => router.refresh());
    },
  );

  const dispararAgora = useFeedbackAction(
    {
      loading: 'Disparando rodada agora…',
      loadingDescription: 'Pode levar alguns segundos por placa.',
      success: 'Rodada concluída',
      error: 'Rodada falhou',
    },
    async () => {
      const res = await fetch('/api/agendamento/run-now', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      startTransition(() => router.refresh());
    },
  );

  const cronExpr = `${minuto} ${hora} * * ${Array.from(dias).sort().join(',') || '*'}`;
  const proximaExecLabel = formatProximaExec(initial.proximaExec, ativo);
  const ultimaExecLabel  = formatUltimaExec(initial.ultimaExec);
  const placasSelecionadasCount = placas.size;

  return (
    <>
    <ResumoPainel items={itensResumo} contexto="agendamento" onFiltrosChange={setResumoFiltros} />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* COL ESQUERDA: configuração principal */}
      <div className="lg:col-span-2 space-y-4">
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-accent dark:text-accent-soft" />
              <h2 className="h-section">Quando rodar</h2>
              <InfoHint label="Quando rodar">
                A cada execução agendada, o sistema busca os atendimentos do período
                padrão (definido nas Configurações) e dispara as cobranças no horário escolhido.
              </InfoHint>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-accent w-4 h-4"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-ivory-200">
                {ativo ? 'Ativo' : 'Desligado'}
              </span>
            </label>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500 mb-2">
                Dias da semana
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => {
                  const on = dias.has(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDia(d.id)}
                      aria-pressed={on}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold tracking-wide transition-all
                                  ${on
                                    ? 'bg-accent text-white shadow-elev-1 dark:bg-accent-deep'
                                    : 'bg-mist-100 text-slate-600 hover:bg-mist-200 dark:bg-deep-50 dark:text-ivory-300 dark:hover:bg-ivory-200/[0.06]'}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-ivory-500">
                <button type="button" onClick={() => setDias(new Set([1,2,3,4,5]))} className="hover:text-accent">Dias úteis</button>
                <span>·</span>
                <button type="button" onClick={() => setDias(new Set([0,1,2,3,4,5,6]))} className="hover:text-accent">Todos</button>
                <span>·</span>
                <button type="button" onClick={() => setDias(new Set())} className="hover:text-accent">Limpar</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500 mb-2">
                Horário
              </label>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400 dark:text-ivory-500" />
                <input
                  type="number" min={0} max={23}
                  className="form-input w-20 tabular-nums text-center"
                  value={hora}
                  onChange={(e) => setHora(clamp(parseInt(e.target.value, 10) || 0, 0, 23))}
                  aria-label="Hora"
                />
                <span className="text-slate-400">:</span>
                <input
                  type="number" min={0} max={59}
                  className="form-input w-20 tabular-nums text-center"
                  value={minuto}
                  onChange={(e) => setMinuto(clamp(parseInt(e.target.value, 10) || 0, 0, 59))}
                  aria-label="Minuto"
                />
                <span className="text-xs text-slate-500 dark:text-ivory-500 ml-2">
                  <span className="font-mono tabular-nums">
                    {String(hora).padStart(2,'0')}:{String(minuto).padStart(2,'0')}
                  </span>
                  {' '}— horário do servidor
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-mist-50 dark:bg-deep-200 border border-mist-200 dark:border-ivory-200/10 p-3 text-xs text-slate-600 dark:text-ivory-400 font-mono">
              <span className="text-slate-400 dark:text-ivory-500 mr-2">cron:</span>
              <span className="tabular-nums">{cronExpr}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 mb-4">
            <ListChecks size={18} className="text-accent dark:text-accent-soft" />
            <h2 className="h-section">O que vai disparar</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <ModoCard
              ativo={modo === 'massa'}
              onClick={() => setModo('massa')}
              titulo="Tudo do período"
              desc="Dispara todas as cobranças mapeáveis encontradas na busca padrão."
              icon={<Sparkles size={16} />}
            />
            <ModoCard
              ativo={modo === 'selecionados'}
              onClick={() => setModo('selecionados')}
              titulo="Só placas selecionadas"
              desc={`${placasSelecionadasCount} placa${placasSelecionadasCount === 1 ? '' : 's'} guardada${placasSelecionadasCount === 1 ? '' : 's'} no save.`}
              icon={<ListChecks size={16} />}
            />
          </div>

          {modo === 'selecionados' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Buscar placa, modelo ou prestador…"
                className="form-input"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <div className="rounded-xl border border-mist-200 dark:border-ivory-200/10 max-h-72 overflow-auto">
                {atendimentosFiltrados.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-ivory-500">
                    Nenhum atendimento bateu com o filtro.
                  </div>
                ) : (
                  atendimentosFiltrados.map((a) => {
                    const on = placas.has(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-3 px-3 py-2 border-b border-mist-100 dark:border-ivory-200/[0.05] cursor-pointer transition-colors
                                    hover:bg-mist-50 dark:hover:bg-ivory-200/[0.04]
                                    ${on ? 'bg-accent/5 dark:bg-accent-deep/15' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="accent-accent w-4 h-4"
                          checked={on}
                          onChange={() => togglePlaca(a.id)}
                        />
                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900 dark:text-ivory-200">{a.placa}</span>
                          <span className="text-xs text-slate-500 dark:text-ivory-400 truncate">{a.modelo}</span>
                          <span className="text-xs text-slate-400 dark:text-ivory-500 truncate">· {a.prestador || '—'}</span>
                          <span className="ml-auto font-mono tabular-nums text-xs text-slate-700 dark:text-ivory-300">{a.valorFmt}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-ivory-500">
                <button type="button" onClick={() => setPlacas(new Set(atendimentosFiltrados.map((a) => a.id)))} className="hover:text-accent">
                  Selecionar visíveis
                </button>
                <span>·</span>
                <button type="button" onClick={() => setPlacas(new Set())} className="hover:text-accent">
                  Limpar seleção
                </button>
                <span className="ml-auto">
                  <strong className="font-mono tabular-nums text-slate-700 dark:text-ivory-300">{placasSelecionadasCount}</strong> selecionada{placasSelecionadasCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between sticky bottom-2 z-10">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className="btn-primary"
              disabled={!dirty || salvar.loading}
              onClick={() => salvar.run()}
            >
              <Save size={13} />
              {salvar.loading ? 'Salvando…' : dirty ? 'Salvar agendamento' : 'Salvo'}
            </button>
            <button
              className="btn-outline"
              disabled={dispararAgora.loading}
              onClick={() => dispararAgora.run()}
              title="Roda uma rodada agora, sem esperar o cron — útil pra testar"
            >
              <Zap size={13} />
              {dispararAgora.loading ? 'Disparando…' : 'Disparar agora'}
            </button>
          </div>
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Alterações pendentes — salve para aplicar.
            </span>
          )}
        </div>
      </div>

      {/* COL DIREITA: status + última execução */}
      <div className="space-y-4">
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500 mb-3">
            Próxima execução
          </h3>
          {initial.ativo ? (
            <p className="font-display text-xl sm:text-2xl text-slate-900 dark:text-ivory-200 leading-tight">
              {proximaExecLabel}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-ivory-500">
              Agendamento desligado. Ative e salve para começar.
            </p>
          )}
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500 mb-3">
            Última execução
          </h3>
          {!initial.ultimaExec ? (
            <p className="text-sm text-slate-500 dark:text-ivory-500">Ainda não rodou.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-slate-700 dark:text-ivory-300">{ultimaExecLabel}</p>
              <div className="flex flex-wrap gap-3 font-mono tabular-nums text-xs">
                <Stat label="Total"     value={initial.ultimoTotal ?? 0} />
                <Stat label="Entregues" value={initial.ultimoOk ?? 0} tone="success" />
                <Stat label="Falhas"    value={initial.ultimoFalha ?? 0} tone={initial.ultimoFalha ? 'danger' : 'neutral'} />
              </div>
              {initial.ultimoErro && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                  <span className="font-semibold">Erro:</span> {initial.ultimoErro}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500 mb-3">
            <Play size={12} className="inline mr-1 mb-0.5" /> Como funciona
          </h3>
          <ol className="text-xs text-slate-600 dark:text-ivory-400 space-y-2 leading-relaxed list-decimal list-inside">
            <li>O scheduler do servidor checa o cron a cada minuto.</li>
            <li>Quando bate o horário, busca atendimentos da DevSul e dispara cada cobrança via WhatsApp.</li>
            <li>Resultados aparecem em <span className="font-semibold">Histórico</span> com origem <code className="font-mono">AUTO</code>.</li>
            <li>Se o servidor cair, o scheduler retoma quando subir.</li>
          </ol>
        </motion.div>
      </div>
    </div>
    </>
  );
}

function ModoCard({
  ativo, onClick, titulo, desc, icon,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`text-left rounded-xl border p-3 sm:p-4 transition-all
                  ${ativo
                    ? 'border-accent bg-accent/5 dark:border-accent-deep dark:bg-accent-deep/15'
                    : 'border-mist-200 hover:border-accent/40 hover:bg-mist-50 dark:border-ivory-200/10 dark:hover:border-ivory-200/20 dark:hover:bg-ivory-200/[0.04]'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={ativo ? 'text-accent dark:text-accent-soft' : 'text-slate-400 dark:text-ivory-500'}>{icon}</span>
        <span className="font-semibold text-sm text-slate-900 dark:text-ivory-200">{titulo}</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-ivory-400 leading-relaxed">{desc}</p>
    </button>
  );
}

function Stat({
  label, value, tone = 'neutral',
}: { label: string; value: number; tone?: 'success' | 'danger' | 'neutral' }) {
  const color =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'danger' ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-900 dark:text-ivory-200';
  return (
    <div className="flex flex-col">
      <span className="text-[0.6rem] uppercase tracking-wider text-slate-500 dark:text-ivory-500">{label}</span>
      <span className={`text-base font-bold ${color}`}>{value}</span>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const DT_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit',
  hour12: false,
});

function formatProximaExec(iso: string | null, ativo: boolean): string {
  if (!ativo) return 'Desligado';
  if (!iso) return 'Sem dia da semana selecionado';
  return DT_FMT.format(new Date(iso));
}

function formatUltimaExec(iso: string | null): string {
  if (!iso) return '—';
  return DT_FMT.format(new Date(iso));
}
