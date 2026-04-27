'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, ChevronRight, Filter, Users, Building2, FileText,
  Wallet, Hash, Activity, X,
} from 'lucide-react';
import {
  type ItemResumo, calcKPIs, sliceBy, type SliceLinha,
} from '../../lib/resumo-types';

interface Props {
  items: ItemResumo[];
  /** Identifica a tela: muda título e mostra "Por Status" só em historico. */
  contexto: 'disparos' | 'historico' | 'agendamento';
  /** Callback opcional pra propagar filtros de drill-down pra tabela pai. */
  onDrillDown?: (filtros: ResumoFiltros) => void;
}

export interface ResumoFiltros {
  prestadores: string[];
  associacoes: string[];
  cnpjs: string[];
  status?: string[];
  valorMin?: number;
  valorMax?: number;
}

type Tab = 'prestador' | 'associacao' | 'cnpj' | 'status';

const ease = [0.16, 1, 0.3, 1] as const;

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = (n: number) => n.toLocaleString('pt-BR');

export function ResumoPainel({ items, contexto, onDrillDown }: Props) {
  const [aberto, setAberto] = useState(false);
  const [tab, setTab] = useState<Tab>('prestador');

  // Filtros internos do painel
  const [prestadoresSel, setPrestadoresSel] = useState<Set<string>>(new Set());
  const [associacoesSel, setAssociacoesSel] = useState<Set<string>>(new Set());
  const [cnpjsSel,       setCnpjsSel]       = useState<Set<string>>(new Set());
  const [valorMin, setValorMin] = useState<string>('');
  const [valorMax, setValorMax] = useState<string>('');

  const filtros = useMemo<ResumoFiltros>(() => ({
    prestadores: Array.from(prestadoresSel),
    associacoes: Array.from(associacoesSel),
    cnpjs:       Array.from(cnpjsSel),
    valorMin:    valorMin === '' ? undefined : Number(valorMin),
    valorMax:    valorMax === '' ? undefined : Number(valorMax),
  }), [prestadoresSel, associacoesSel, cnpjsSel, valorMin, valorMax]);

  const itemsFiltrados = useMemo(() => {
    return items.filter((i) => {
      if (filtros.prestadores.length && !filtros.prestadores.includes(i.prestador)) return false;
      if (filtros.associacoes.length && !filtros.associacoes.includes(i.associacao)) return false;
      if (filtros.cnpjs.length        && !filtros.cnpjs.includes(i.cnpj))            return false;
      if (filtros.valorMin !== undefined && i.valor < filtros.valorMin)              return false;
      if (filtros.valorMax !== undefined && i.valor > filtros.valorMax)              return false;
      return true;
    });
  }, [items, filtros]);

  const kpis = useMemo(() => calcKPIs(itemsFiltrados), [itemsFiltrados]);
  const linhasSlice = useMemo(() => sliceBy(itemsFiltrados, tab), [itemsFiltrados, tab]);

  // Listas distintas pra autocompletar/popular multi-selects
  const distintas = useMemo(() => ({
    prestadores: distinct(items, (i) => i.prestador),
    associacoes: distinct(items, (i) => i.associacao),
    cnpjs:       distinct(items, (i) => i.cnpj),
  }), [items]);

  const filtrosAtivos =
    prestadoresSel.size + associacoesSel.size + cnpjsSel.size +
    (valorMin !== '' ? 1 : 0) + (valorMax !== '' ? 1 : 0);

  function limparFiltros() {
    setPrestadoresSel(new Set());
    setAssociacoesSel(new Set());
    setCnpjsSel(new Set());
    setValorMin(''); setValorMax('');
  }

  function aplicarDrillDown(campo: Tab, chave: string) {
    if (campo === 'prestador') toggleSet(prestadoresSel, setPrestadoresSel, chave);
    if (campo === 'associacao') toggleSet(associacoesSel, setAssociacoesSel, chave);
    if (campo === 'cnpj')       toggleSet(cnpjsSel,       setCnpjsSel,       chave);
    onDrillDown?.(filtros);
  }

  return (
    <div className="card mb-4 overflow-hidden">
      {/* Header colapsável */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-3 -m-4 sm:-m-5 lg:-m-6 mb-0 p-4 sm:p-5 lg:p-6 hover:bg-mist-50 dark:hover:bg-ivory-200/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Filter className="text-accent dark:text-accent-soft" size={18} />
          <h2 className="h-section">Resumo & Filtros</h2>
          <span className="text-xs text-slate-500 dark:text-ivory-500 tabular-nums">
            {NUM(kpis.total)} {kpis.total === 1 ? 'item' : 'itens'}
            {filtrosAtivos > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/10 dark:bg-accent-deep/20 text-accent dark:text-accent-soft px-2 py-0.5 text-[0.65rem] font-mono font-semibold">
                {filtrosAtivos} filtro{filtrosAtivos === 1 ? '' : 's'}
              </span>
            )}
          </span>
        </div>
        <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-slate-400 dark:text-ivory-500">
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden"
          >
            <div className="pt-4 sm:pt-5 space-y-4 sm:space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <Kpi label="Itens"        value={NUM(kpis.total)}              icon={<Activity size={14} />} />
                <Kpi label="Valor total"  value={BRL(kpis.valorTotal)}         icon={<Wallet size={14} />}    tone="success" />
                <Kpi label="Prestadores"  value={NUM(kpis.prestadoresDistintos)} icon={<Users size={14} />} />
                <Kpi label="Associações"  value={NUM(kpis.associacoesDistintas)} icon={<Building2 size={14} />} />
                <Kpi label="CNPJs"        value={NUM(kpis.cnpjsDistintos)}     icon={<Hash size={14} />}      />
              </div>

              {/* Filtros */}
              <div className="rounded-xl border border-mist-200 dark:border-ivory-200/10 bg-mist-50/50 dark:bg-deep-200/40 p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[0.65rem] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500">
                    Filtrar
                  </span>
                  {filtrosAtivos > 0 && (
                    <button
                      onClick={limparFiltros}
                      className="ml-auto inline-flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <X size={11} /> Limpar tudo
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <MultiSelect label="Associação"
                    options={distintas.associacoes}
                    selected={associacoesSel} onChange={setAssociacoesSel}
                    icon={<Building2 size={12} />} />
                  <MultiSelect label="Prestador"
                    options={distintas.prestadores}
                    selected={prestadoresSel} onChange={setPrestadoresSel}
                    icon={<Users size={12} />} />
                  <MultiSelect label="CNPJ"
                    options={distintas.cnpjs}
                    selected={cnpjsSel} onChange={setCnpjsSel}
                    icon={<Hash size={12} />} mono />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-mono uppercase tracking-wider text-slate-500 dark:text-ivory-500">
                    Valor R$
                  </span>
                  <input type="number" placeholder="mín" className="form-input w-24 text-xs tabular-nums" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
                  <span className="text-slate-400">—</span>
                  <input type="number" placeholder="máx" className="form-input w-24 text-xs tabular-nums" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
                </div>

                {/* Chips ativos */}
                {filtrosAtivos > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.from(prestadoresSel).map((v) => (
                      <Chip key={`p-${v}`} label={`Prestador: ${v}`} onClear={() => toggleSet(prestadoresSel, setPrestadoresSel, v)} />
                    ))}
                    {Array.from(associacoesSel).map((v) => (
                      <Chip key={`a-${v}`} label={`Assoc.: ${v}`} onClear={() => toggleSet(associacoesSel, setAssociacoesSel, v)} />
                    ))}
                    {Array.from(cnpjsSel).map((v) => (
                      <Chip key={`c-${v}`} label={`CNPJ: ${v}`} onClear={() => toggleSet(cnpjsSel, setCnpjsSel, v)} mono />
                    ))}
                    {valorMin !== '' && <Chip label={`R$ ≥ ${valorMin}`} onClear={() => setValorMin('')} />}
                    {valorMax !== '' && <Chip label={`R$ ≤ ${valorMax}`} onClear={() => setValorMax('')} />}
                  </div>
                )}
              </div>

              {/* Tabs de slice */}
              <div>
                <div className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-deep-50 p-0.5 sm:p-1 w-fit">
                  <TabBtn ativo={tab === 'prestador'}  onClick={() => setTab('prestador')}>Por prestador</TabBtn>
                  <TabBtn ativo={tab === 'associacao'} onClick={() => setTab('associacao')}>Por associação</TabBtn>
                  <TabBtn ativo={tab === 'cnpj'}       onClick={() => setTab('cnpj')}>Por CNPJ</TabBtn>
                  {contexto === 'historico' && (
                    <TabBtn ativo={tab === 'status'} onClick={() => setTab('status')}>Por status</TabBtn>
                  )}
                </div>

                <div className="mt-3 rounded-xl border border-mist-200 dark:border-ivory-200/10 max-h-72 overflow-auto">
                  {linhasSlice.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-ivory-500">
                      Nenhum dado pra exibir com esses filtros.
                    </div>
                  ) : (
                    linhasSlice.map((l) => (
                      <SliceRow
                        key={l.chave}
                        linha={l}
                        campo={tab}
                        onClick={() => aplicarDrillDown(tab, l.chave)}
                        ativo={
                          (tab === 'prestador' && prestadoresSel.has(l.chave)) ||
                          (tab === 'associacao' && associacoesSel.has(l.chave)) ||
                          (tab === 'cnpj' && cnpjsSel.has(l.chave))
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({
  label, value, icon, tone = 'default',
}: { label: string; value: string; icon: React.ReactNode; tone?: 'default' | 'success' }) {
  const color =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-900 dark:text-ivory-200';
  return (
    <div className="rounded-xl border border-mist-200 dark:border-ivory-200/10 bg-white dark:bg-deep-100 p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 text-[0.6rem] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500">
        <span className="text-slate-400 dark:text-ivory-500">{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-lg sm:text-xl font-bold tabular-nums tracking-tight break-all ${color}`}>
        {value}
      </div>
    </div>
  );
}

function TabBtn({
  ativo, onClick, children,
}: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`px-2.5 sm:px-3 py-1 rounded-full text-[0.65rem] sm:text-xs font-mono font-semibold tracking-wide transition-all whitespace-nowrap
                  ${ativo
                    ? 'bg-white dark:bg-deep-100 text-slate-900 dark:text-ivory-200 shadow-elev-1'
                    : 'text-slate-500 dark:text-ivory-400 hover:text-slate-900 dark:hover:text-ivory-200'}`}
    >
      {children}
    </button>
  );
}

function SliceRow({
  linha, campo, onClick, ativo,
}: {
  linha: SliceLinha;
  campo: Tab;
  onClick: () => void;
  ativo: boolean;
}) {
  const [expandido, setExpandido] = useState(false);
  const sub = (campo === 'cnpj' ? linha.prestadoresAtrelados : campo === 'associacao' ? linha.cnpjsAtrelados : null) ?? [];
  const hasSub = sub.length > 1;

  return (
    <div className={`border-b border-mist-100 dark:border-ivory-200/[0.05] last:border-b-0 transition-colors
                     ${ativo ? 'bg-accent/5 dark:bg-accent-deep/15' : 'hover:bg-mist-50 dark:hover:bg-ivory-200/[0.04]'}`}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={onClick}>
        {hasSub && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpandido((v) => !v); }}
            className="shrink-0 text-slate-400 dark:text-ivory-500 hover:text-accent"
          >
            <motion.span animate={{ rotate: expandido ? 90 : 0 }} transition={{ duration: 0.18 }} className="inline-flex">
              <ChevronRight size={14} />
            </motion.span>
          </button>
        )}
        {!hasSub && <span className="w-3.5" />}
        <span className={`flex-1 min-w-0 truncate ${campo === 'cnpj' ? 'font-mono' : ''} text-sm text-slate-700 dark:text-ivory-300`}>
          {linha.chave || '—'}
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-ivory-500 whitespace-nowrap">
          {NUM(linha.qtd)}×
        </span>
        <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-ivory-200 whitespace-nowrap">
          {linha.somaValorFmt}
        </span>
      </div>
      {hasSub && expandido && (
        <div className="pl-9 pr-3 pb-2 text-xs text-slate-500 dark:text-ivory-400 space-y-0.5">
          {sub.map((s) => (
            <div key={s} className={`truncate ${campo === 'associacao' ? 'font-mono' : ''}`}>
              {campo === 'cnpj' ? (
                <><FileText size={10} className="inline mb-0.5 mr-1" />{s}</>
              ) : (
                <><Hash size={10} className="inline mb-0.5 mr-1 font-mono" />{s}</>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  label, options, selected, onChange, icon, mono,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, busca]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 form-input text-xs"
      >
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-ivory-400">
          {icon}
          {label}
          {selected.size > 0 && (
            <span className="rounded-full bg-accent/15 dark:bg-accent-deep/30 text-accent dark:text-accent-soft px-1.5 py-0.5 text-[0.6rem] font-mono font-semibold tabular-nums">
              {selected.size}
            </span>
          )}
        </span>
        <ChevronDown size={12} className="text-slate-400 dark:text-ivory-500" />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1 w-full max-w-md rounded-xl border border-mist-200 dark:border-ivory-200/10 bg-white dark:bg-deep-100 shadow-elev-3 p-2"
          >
            <input
              type="text"
              autoFocus
              placeholder={`Buscar ${label.toLowerCase()}…`}
              className="form-input text-xs mb-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="max-h-56 overflow-auto space-y-0.5">
              {filtradas.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 dark:text-ivory-500">Sem opções.</div>
              ) : filtradas.map((opt) => {
                const on = selected.has(opt);
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs
                                ${on ? 'bg-accent/10 dark:bg-accent-deep/20 text-accent dark:text-accent-soft' : 'hover:bg-mist-50 dark:hover:bg-ivory-200/[0.04] text-slate-700 dark:text-ivory-300'}
                                ${mono ? 'font-mono' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleSet(selected, onChange, opt)}
                      className="accent-accent w-3.5 h-3.5"
                    />
                    <span className="truncate">{opt || '—'}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-mist-100 dark:border-ivory-200/[0.05] mt-2">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[0.65rem] font-mono uppercase tracking-wider text-slate-500 dark:text-ivory-500 hover:text-rose-600 dark:hover:text-rose-400"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-[0.65rem] font-mono uppercase tracking-wider text-accent dark:text-accent-soft hover:underline"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ label, onClear, mono }: { label: string; onClear: () => void; mono?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-accent/10 dark:bg-accent-deep/20 text-accent dark:text-accent-soft px-2 py-0.5 text-[0.65rem]
                      ${mono ? 'font-mono' : ''}`}>
      <span className="truncate max-w-[180px]">{label}</span>
      <button type="button" onClick={onClear} className="hover:text-rose-600 dark:hover:text-rose-400">
        <X size={10} />
      </button>
    </span>
  );
}

function distinct<T>(arr: T[], pick: (x: T) => string): string[] {
  const s = new Set<string>();
  for (const a of arr) {
    const v = pick(a);
    if (v) s.add(v);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function toggleSet(set: Set<string>, setSet: (s: Set<string>) => void, value: string) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  setSet(next);
}
