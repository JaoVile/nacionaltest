'use client';

import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import type { Schema } from 'write-excel-file/browser';
import { Download, RefreshCw, Search, Inbox, ChevronDown } from 'lucide-react';
import { DisparoDetailDrawer } from '../components/DisparoDetailDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { StatChip, type StatChipTone } from '../components/StatChip';
import { EmptyState } from '../components/EmptyState';
import { useFeedbackAction } from '../components/useFeedbackAction';
import { statusAtomosHumano } from '../dashboard/glossario';
import { ResumoPainel } from '../components/ResumoPainel';
import { itemFromDisparo } from '../../lib/resumo-types';

export interface DisparoRow {
  id: string;
  createdAt: string;
  atendimentoId: string;
  placa: string;
  prestador: string | null;
  destinoReal: string;
  destinoEfetivo: string;
  testMode: boolean;
  valor: number;
  dataAtendimento: string;
  valorFmt: string;
  dataFmt: string;
  ultimoStatus: string;
  failureReason: string | null;
  errorMessage: string | null;
  atomosMessageId: string | null;
  statusAtualizadoEm: string | null;
  origem: string;
}

interface Props {
  items: DisparoRow[];
  agregado: Record<string, number>;
}

const STATUSES_DETALHE = ['QUEUED', 'SENT', 'READ', 'FAILED'] as const;
const ENTREGUES = new Set(['DELIVERED', 'READ']);
const ERROS     = new Set(['FAILED', 'ERROR']);

type Filtro = '' | 'entregues' | 'erros' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'ERROR';

function matchFiltro(status: string, filtro: Filtro): boolean {
  if (!filtro) return true;
  if (filtro === 'entregues') return ENTREGUES.has(status);
  if (filtro === 'erros')     return ERROS.has(status);
  return status === filtro;
}

export function HistoricoClient({ items, agregado }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('');
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [verDetalhes, setVerDetalhes] = useState(false);
  const [, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = buscaDeferred.trim().toLowerCase();
    return items.filter((d) => {
      if (!matchFiltro(d.ultimoStatus, filtro)) return false;
      if (!q) return true;
      return [d.placa, d.prestador ?? '', d.atendimentoId, d.atomosMessageId ?? '']
        .some((c) => c.toLowerCase().includes(q));
    });
  }, [items, filtro, buscaDeferred]);

  const totalEntregues = (agregado.DELIVERED ?? 0) + (agregado.READ ?? 0);
  const totalErros     = (agregado.FAILED ?? 0)    + (agregado.ERROR ?? 0);

  const pendentes = useMemo(
    () => items.filter((d) => ['QUEUED', 'SENT'].includes(d.ultimoStatus)),
    [items],
  );

  const refresh = useFeedbackAction(
    {
      loading: 'Atualizando status…',
      loadingDescription: `${pendentes.length} pendentes consultando Atomos`,
      success: 'Status atualizado',
      error: 'Falha ao atualizar',
    },
    async () => {
      const res = await fetch('/api/historico/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: pendentes.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      startTransition(() => router.refresh());
      return pendentes.length;
    },
  );

  const exportar = useFeedbackAction(
    {
      loading: 'Gerando planilha…',
      loadingDescription: 'Preparando arquivo .xlsx',
      success: (n) => `Planilha gerada (${n} linhas)`,
      error: 'Falha ao gerar Excel',
    },
    async () => {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const schema: Schema<DisparoRow> = [
        { column: 'Disparado em',     type: Date,   format: 'dd/mm/yyyy hh:mm', width: 18, value: (d) => new Date(d.createdAt) },
        { column: 'Placa',            type: String, width: 10, value: (d) => d.placa },
        { column: 'Prestador',        type: String, width: 28, value: (d) => d.prestador ?? '' },
        { column: 'Valor',            type: Number, format: '"R$" #,##0.00',    width: 12, value: (d) => d.valor },
        { column: 'Data atendimento', type: Date,   format: 'dd/mm/yyyy',       width: 14, value: (d) => new Date(d.dataAtendimento) },
        { column: 'Destino',          type: String, width: 16, value: (d) => d.destinoEfetivo },
        { column: 'Status',           type: String, width: 12, value: (d) => d.ultimoStatus },
        { column: 'Origem',           type: String, width: 8,  value: (d) => d.origem },
        { column: 'Detalhe',          type: String, width: 40, value: (d) => d.failureReason ?? d.errorMessage ?? '' },
        { column: 'Message ID',       type: String, width: 38, value: (d) => d.atomosMessageId ?? '' },
      ];
      await writeXlsxFile(filtrados, {
        schema,
        fileName: `disparos_${new Date().toISOString().slice(0, 10)}.xlsx`,
        getHeaderStyle: () => ({ fontWeight: 'bold' }),
      });
      return filtrados.length;
    },
  );

  const columns: Column<DisparoRow>[] = [
    { key: 'quando',   header: 'Quando',   width: '140px', mono: true, tabular: true, cell: (d) => <span className="text-xs text-slate-500 dark:text-ivory-400">{formatarHora(d.createdAt)}</span> },
    { key: 'placa',    header: 'Placa',    width: '110px', mono: true, cell: (d) => <span className="font-semibold">{d.placa}</span> },
    { key: 'prestador', header: 'Prestador', cell: (d) => <span className="truncate block max-w-[220px]" title={d.prestador ?? ''}>{d.prestador ?? '—'}</span> },
    { key: 'valor',    header: 'Valor',    width: '110px', align: 'right', mono: true, tabular: true, cell: (d) => d.valorFmt },
    { key: 'destino',  header: 'Recebeu em', width: '160px', mono: true, cell: (d) =>
      d.testMode
        ? <span title={`Real: ${d.destinoReal}`} className="text-amber-600 dark:text-amber-400 text-xs">{d.destinoEfetivo} (teste)</span>
        : <span className="text-xs">{d.destinoEfetivo}</span> },
    { key: 'status',   header: 'Resultado', width: '170px', cell: (d) => <StatusBadge status={d.ultimoStatus} /> },
    { key: 'origem',   header: 'Origem',    width: '90px',  cell: (d) => <span className="text-xs text-slate-500 dark:text-ivory-500">{origemHumana(d.origem)}</span> },
    { key: 'detalhe',  header: 'Observação', cell: (d) =>
      <span className="text-xs text-slate-600 dark:text-ivory-400 truncate block max-w-[260px]" title={d.failureReason ?? d.errorMessage ?? ''}>
        {d.failureReason ?? d.errorMessage ?? '—'}
      </span> },
  ];

  const itensResumo = useMemo(() => items.map(itemFromDisparo), [items]);

  return (
    <>
      <ResumoPainel items={itensResumo} contexto="historico" />

      <div className="grid grid-cols-3 gap-3 mb-3">
        <StatChip label="Todos"     value={items.length}    active={filtro === ''}          onClick={() => setFiltro('')}                                          tone="default" delay={0}   />
        <StatChip label="Entregues" value={totalEntregues}  active={filtro === 'entregues'} onClick={() => setFiltro(filtro === 'entregues' ? '' : 'entregues')} tone="success" delay={50}  />
        <StatChip label="Erros"     value={totalErros}      active={filtro === 'erros'}     onClick={() => setFiltro(filtro === 'erros' ? '' : 'erros')}         tone="danger"  delay={100} />
      </div>

      <div className="mb-5">
        <button
          type="button"
          onClick={() => setVerDetalhes((v) => !v)}
          className="inline-flex items-center gap-1 text-[0.65rem] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-ivory-500 hover:text-accent dark:hover:text-accent-soft transition-colors"
        >
          {verDetalhes ? 'Esconder detalhes' : 'Ver detalhes por status'}
          <motion.span animate={{ rotate: verDetalhes ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={12} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {verDetalhes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                {STATUSES_DETALHE.map((s, i) => (
                  <StatChip
                    key={s}
                    compact
                    label={statusAtomosHumano(s).label}
                    value={agregado[s] ?? 0}
                    active={filtro === s}
                    onClick={() => setFiltro(filtro === s ? '' : s)}
                    tone={toneForStatus(s)}
                    delay={30 * (i + 1)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="card mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ivory-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por placa, prestador ou ID…"
              className="form-input pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar no histórico"
            />
          </div>
          <div className="text-sm text-slate-500 dark:text-ivory-400 tabular-nums">
            <span className="font-mono font-semibold text-slate-900 dark:text-ivory-100">{filtrados.length}</span>
            {' '}de {items.length}
          </div>
          <button
            data-refresh-pendentes
            className="btn-outline w-full sm:w-auto"
            disabled={pendentes.length === 0 || refresh.loading}
            onClick={() => refresh.run()}
            title="Consulta de novo o WhatsApp para ver se as mensagens aguardando já foram entregues (⌘R)"
          >
            <RefreshCw size={13} className={refresh.loading ? 'animate-spin' : ''} />
            {refresh.loading
              ? 'Atualizando…'
              : pendentes.length > 0
                ? `Atualizar aguardando (${pendentes.length})`
                : 'Nada pra atualizar'}
          </button>
          <button
            data-export-excel
            className="btn-outline w-full sm:w-auto"
            disabled={exportar.loading || filtrados.length === 0}
            onClick={() => exportar.run()}
            title="Baixa uma planilha Excel com os registros filtrados (⌘E)"
          >
            <Download size={13} />
            {exportar.loading ? 'Gerando…' : `Baixar planilha (${filtrados.length})`}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtrados}
        getRowId={(d) => d.id}
        onRowClick={(d) => setDrawerId(d.id)}
        maxHeight="640px"
        rowHeight={44}
        empty={
          <EmptyState
            icon={<Inbox size={22} />}
            title="Nenhuma cobrança por aqui"
            description={items.length === 0
              ? 'Ainda não enviamos nenhuma mensagem. Use "Executar agora" no painel principal para começar.'
              : 'Nada bateu com a busca. Limpe os filtros para ver todos os envios.'}
            action={
              items.length === 0
                ? null
                : (
                  <button className="btn-outline" onClick={() => { setBusca(''); setFiltro(''); }}>
                    Limpar filtros
                  </button>
                )
            }
          />
        }
      />

      <DisparoDetailDrawer disparoId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const h = statusAtomosHumano(status);
  const cls =
    status === 'DELIVERED' || status === 'READ' ? 'badge-success'
    : status === 'SENT'                        ? 'badge-info'
    : status === 'QUEUED'                      ? 'badge-info'
    : status === 'FAILED' || status === 'ERROR' ? 'badge-danger'
    : 'badge-neutral';
  return (
    <span
      className={`${cls} whitespace-nowrap !tracking-normal !text-[0.65rem] !normal-case !font-semibold`}
      title={`Status WhatsApp: ${status}`}
    >
      {h.label}
    </span>
  );
}

function origemHumana(origem: string): string {
  const up = origem.toUpperCase();
  if (up === 'UI')   return 'Painel';
  if (up === 'AUTO') return 'Automático';
  if (up === 'TEST') return 'Teste';
  return origem;
}

function toneForStatus(s: string): StatChipTone {
  if (s === 'DELIVERED' || s === 'READ') return 'success';
  if (s === 'SENT' || s === 'QUEUED')   return 'info';
  if (s === 'FAILED' || s === 'ERROR')  return 'danger';
  return 'default';
}

const HORA_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit',
  hour12: false,
});

function formatarHora(iso: string): string {
  return HORA_FMT.format(new Date(iso));
}
