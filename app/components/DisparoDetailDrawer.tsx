'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ChevronRight } from 'lucide-react';
import { AnimatedModal } from './AnimatedModal';
import { Timeline, type TimelineEvent, type TimelineTone } from './Timeline';
import { AnimatePresence, motion } from 'framer-motion';
import { statusAtomosHumano } from '../dashboard/glossario';

export interface DisparoFull {
  id: string;
  createdAt: string;
  updatedAt: string;
  atendimentoId: string;
  placa: string;
  modelo: string | null;
  valor: number;
  dataAtendimento: string;
  prestador: string | null;
  destinoReal: string;
  destinoEfetivo: string;
  testMode: boolean;
  templateId: string;
  atomosMessageId: string | null;
  atomosSessionId: string | null;
  ultimoStatus: string;
  failureReason: string | null;
  errorMessage: string | null;
  statusAtualizadoEm: string | null;
  vPlaca: string;
  vModelo: string;
  vValor: string;
  vData: string;
  requestPayload: string | null;
  responseBody: string | null;
  httpStatus: number | null;
  statusCheckBody: string | null;
  rawAtendimento: string | null;
  elapsedMs: number | null;
  origem: string;
  concluirEm: string | null;
  concluidoEm: string | null;
  concluidoOk: boolean | null;
  concluidoHttpStatus: number | null;
  concluidoResponse: string | null;
  respostaDetectada: boolean | null;
  eventos: Array<{
    id: string;
    status: string;
    failureReason: string | null;
    observadoEm: string;
  }>;
}

export interface AuditRow {
  id: string;
  action: string;
  userEmail: string | null;
  ip: string | null;
  statusCode: number | null;
  errorMsg: string | null;
  metadata: string | null;
  createdAt: string;
}

interface Props {
  disparoId: string | null;
  onClose: () => void;
}

export function DisparoDetailDrawer({ disparoId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [disparo, setDisparo] = useState<DisparoFull | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!disparoId) return;
    let cancel = false;
    setLoading(true);
    setErro(null);
    setDisparo(null);
    setAuditLogs([]);

    fetch(`/api/disparos/${disparoId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        return r.json();
      })
      .then((data) => {
        if (cancel) return;
        setDisparo(data.disparo);
        setAuditLogs(data.auditLogs ?? []);
      })
      .catch((e) => {
        if (!cancel) setErro((e as Error).message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });

    return () => {
      cancel = true;
    };
  }, [disparoId]);

  const timelineEvents: TimelineEvent[] = disparo
    ? disparo.eventos.map((e) => ({
        id: e.id,
        title: statusAtomosHumano(e.status).label,
        description: e.failureReason,
        timestamp: fmtDateTime(e.observadoEm),
        tone: toneForStatus(e.status),
      }))
    : [];

  return (
    <AnimatedModal
      open={!!disparoId}
      onClose={onClose}
      variant="side-right"
      title="Detalhes do envio"
    >
      {disparoId && (
        <div className="-mt-2 mb-4">
          <details>
            <summary className="text-xs text-slate-500 dark:text-ivory-500 cursor-pointer hover:text-slate-700 dark:hover:text-ivory-200 select-none">
              Ver ID interno deste envio
            </summary>
            <p className="mt-1 text-xs text-slate-500 dark:text-ivory-500 font-mono break-all">{disparoId}</p>
          </details>
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-ivory-200/[0.05] animate-pulse-soft" style={{ width: `${80 + Math.random() * 20}%` }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {erro && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 p-3 text-sm">
          Falha ao carregar: {erro}
        </div>
      )}

      {disparo && (
        <div className="space-y-4">
          <Section title="Resumo" defaultOpen>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Item label="Como terminou"      value={statusAtomosHumano(disparo.ultimoStatus).label} />
              <Item label="Tempo de envio"     value={disparo.elapsedMs != null ? `${disparo.elapsedMs} ms` : '—'} />
              <Item label="Origem do envio"    value={origemHumanaDrawer(disparo.origem)} />
              <Item label="Ambiente"           value={disparo.testMode ? 'Teste (mensagens para o número de teste)' : 'Produção (prestador real)'} />
              <Item label="Enviada em"         value={fmtDateTime(disparo.createdAt)} />
              <Item label="Última atualização" value={disparo.statusAtualizadoEm ? fmtDateTime(disparo.statusAtualizadoEm) : '—'} />
              <Item label="Código HTTP"        value={disparo.httpStatus ?? '—'} mono />
              <Item label="Template usado"     value={disparo.templateId} mono />
              <Item label="ID da mensagem no WhatsApp" value={disparo.atomosMessageId ?? '—'} mono copyable />
              <Item label="ID da conversa"     value={disparo.atomosSessionId ?? '—'} mono copyable />
            </dl>
          </Section>

          <Section title="Sobre o atendimento">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Item label="Placa"     value={disparo.placa} mono />
              <Item label="Modelo"    value={disparo.modelo ?? '—'} />
              <Item label="Valor"     value={fmtBRL(disparo.valor)} />
              <Item label="Data do atendimento" value={fmtDate(disparo.dataAtendimento)} />
              <Item label="Prestador" value={disparo.prestador ?? '—'} />
              <Item label="ID na DevSul" value={disparo.atendimentoId} mono copyable />
            </dl>
          </Section>

          <Section title="Para quem foi">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Item label="Telefone do prestador" value={disparo.destinoReal || '—'} mono copyable />
              <Item label="Número que recebeu"    value={disparo.destinoEfetivo} mono copyable />
              {disparo.testMode && (
                <div className="sm:col-span-2">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-300">
                    <strong>Modo de teste.</strong> A mensagem foi para o número de teste, não para o prestador real.
                  </div>
                </div>
              )}
            </dl>
          </Section>

          <Section title="Dados preenchidos na mensagem">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Item label="Placa"  value={disparo.vPlaca} mono />
              <Item label="Modelo" value={disparo.vModelo} />
              <Item label="Valor"  value={disparo.vValor} mono />
              <Item label="Data"   value={disparo.vData} mono />
            </dl>
          </Section>

          {(disparo.failureReason || disparo.errorMessage) && (
            <Section title="O que deu errado" defaultOpen>
              {disparo.failureReason && <ErrorBlock label="Motivo (WhatsApp)" value={disparo.failureReason} />}
              {disparo.errorMessage  && <ErrorBlock label="Erro técnico"      value={disparo.errorMessage} />}
            </Section>
          )}

          {(disparo.concluirEm || disparo.concluidoEm) && (
            <Section title="Auto-conclusão da conversa" defaultOpen={disparo.concluidoEm == null}>
              <AutoCompleteBlock disparo={disparo} />
            </Section>
          )}

          <Section title={`Linha do tempo (${disparo.eventos.length} ${disparo.eventos.length === 1 ? 'evento' : 'eventos'})`} defaultOpen>
            <Timeline events={timelineEvents} />
          </Section>

          <JsonSection title="Dados técnicos — o que enviamos ao WhatsApp" raw={disparo.requestPayload} />
          <JsonSection
            title={`Dados técnicos — resposta do WhatsApp${disparo.httpStatus != null ? ` (HTTP ${disparo.httpStatus})` : ''}`}
            raw={disparo.responseBody}
          />
          {disparo.statusCheckBody && <JsonSection title="Dados técnicos — consulta de status depois" raw={disparo.statusCheckBody} />}
          {disparo.concluidoResponse && <JsonSection title="Dados técnicos — resposta do PUT complete" raw={disparo.concluidoResponse} />}
          <JsonSection title="Dados técnicos — atendimento original da DevSul" raw={disparo.rawAtendimento} />

          {auditLogs.length > 0 && (
            <Section title={`Ações registradas (${auditLogs.length})`}>
              <div className="space-y-2">
                {auditLogs.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 dark:border-ivory-200/10 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-semibold text-slate-900 dark:text-ivory-100">{a.action}</span>
                      <span className="text-slate-500 dark:text-ivory-500">{fmtDateTime(a.createdAt)}</span>
                    </div>
                    <div className="text-slate-500 dark:text-ivory-400 space-y-0.5">
                      {a.userEmail && <div><span className="text-slate-700 dark:text-ivory-200">Quem:</span> {a.userEmail}</div>}
                      {a.ip        && <div><span className="text-slate-700 dark:text-ivory-200">IP:</span> <span className="font-mono">{a.ip}</span></div>}
                      <div><span className="text-slate-700 dark:text-ivory-200">Código HTTP:</span> <span className="font-mono">{a.statusCode ?? '—'}</span></div>
                      {a.errorMsg && <div className="text-rose-500"><span className="font-semibold">Erro:</span> {a.errorMsg}</div>}
                    </div>
                    {a.metadata && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-slate-500 dark:text-ivory-400 select-none">
                          Dados adicionais (técnico)
                        </summary>
                        <pre className="mt-1 bg-slate-50 dark:bg-deep-200 border border-slate-100 dark:border-ivory-200/5 rounded p-2 overflow-x-auto text-[11px] leading-relaxed">
                          {formatJson(a.metadata)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </AnimatedModal>
  );
}

function Section({
  title, children, defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-slate-200 dark:border-ivory-200/10 bg-slate-50/50 dark:bg-ivory-200/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left
                   hover:bg-slate-100/80 dark:hover:bg-ivory-200/[0.04] rounded-xl transition-colors"
      >
        <span className="font-semibold text-sm text-slate-900 dark:text-ivory-100">{title}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-slate-400 dark:text-ivory-500">
          <ChevronRight size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function JsonSection({ title, raw }: { title: string; raw: string | null }) {
  const [copied, setCopied] = useState(false);
  const pretty = raw ? formatJson(raw) : null;

  return (
    <Section title={title}>
      {!pretty ? (
        <p className="text-sm text-slate-500 dark:text-ivory-400">Sem dados registrados.</p>
      ) : (
        <div className="relative">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(pretty);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono
                       bg-white dark:bg-deep-50 border border-slate-200 dark:border-ivory-200/15
                       hover:bg-slate-50 dark:hover:bg-deep-100 text-slate-600 dark:text-ivory-300
                       transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'ok' : 'copiar'}
          </button>
          <pre className="bg-slate-900 dark:bg-black text-ivory-100 rounded-lg p-3 pr-20 overflow-x-auto text-[11px] leading-relaxed font-mono whitespace-pre max-h-96">
            {pretty}
          </pre>
        </div>
      )}
    </Section>
  );
}

function Item({
  label, value, mono, copyable,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const show = String(value);
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-ivory-500">{label}</dt>
      <dd
        className={`${mono ? 'font-mono text-xs' : 'text-sm'} text-slate-900 dark:text-ivory-100 break-all flex items-center gap-1`}
      >
        <span className="min-w-0 break-all">{show}</span>
        {copyable && show !== '—' && (
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(show);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {}
            }}
            className="shrink-0 p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-ivory-200/10
                       text-slate-400 hover:text-slate-700 dark:text-ivory-500 dark:hover:text-ivory-200"
            title="Copiar"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        )}
      </dd>
    </div>
  );
}

function AutoCompleteBlock({ disparo }: { disparo: DisparoFull }) {
  const pendente = disparo.concluirEm && !disparo.concluidoEm;
  const concluido = !!disparo.concluidoEm;
  const okFinal = concluido && disparo.concluidoOk === true;
  const erroFinal = concluido && disparo.concluidoOk === false;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Item
          label="Status"
          value={
            pendente
              ? `Aguardando — agendado para ${fmtDateTime(disparo.concluirEm!)}`
              : okFinal
              ? `Conversa concluída em ${fmtDateTime(disparo.concluidoEm!)}`
              : erroFinal
              ? `Falhou em ${fmtDateTime(disparo.concluidoEm!)}`
              : '—'
          }
        />
        {disparo.concluidoHttpStatus != null && (
          <Item label="Código HTTP" value={disparo.concluidoHttpStatus} mono />
        )}
        {disparo.respostaDetectada !== null && disparo.respostaDetectada !== undefined && (
          <div className="sm:col-span-2">
            <div
              className={`rounded-lg p-3 text-sm border ${
                disparo.respostaDetectada
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-200'
                  : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-ivory-200/[0.04] dark:border-ivory-200/15 dark:text-ivory-200'
              }`}
            >
              {disparo.respostaDetectada ? (
                <>
                  <strong>Prestador respondeu</strong> durante a janela de espera (detectado pelo
                  campo <code className="font-mono">lastMessageIn</code> da conversa).
                </>
              ) : (
                <>
                  Sem resposta do prestador durante a janela. Conversa foi concluída
                  {disparo.concluidoResponse ? ' (com reabertura automática se ele responder depois)' : ''}.
                </>
              )}
            </div>
          </div>
        )}
      </dl>
    </div>
  );
}

function ErrorBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-500/5 p-3 mb-2 last:mb-0">
      <div className="text-xs font-mono font-semibold text-rose-700 dark:text-rose-300 mb-1">{label}</div>
      <div className="text-sm text-rose-800 dark:text-rose-200 whitespace-pre-wrap break-words">{value}</div>
    </div>
  );
}

function toneForStatus(status: string): TimelineTone {
  if (status === 'DELIVERED' || status === 'READ') return 'success';
  if (status === 'SENT' || status === 'QUEUED')   return 'info';
  if (status === 'FAILED' || status === 'ERROR')  return 'danger';
  return 'default';
}

function origemHumanaDrawer(origem: string): string {
  const up = origem.toUpperCase();
  if (up === 'UI')   return 'Clique manual no painel';
  if (up === 'AUTO') return 'Execução automática (cron)';
  if (up === 'TEST') return 'Teste de segurança antes do envio real';
  return origem;
}

function formatJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

const DT_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});
function fmtDateTime(iso: string): string { return DT_FMT.format(new Date(iso)); }

const D_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
});
function fmtDate(iso: string): string { return D_FMT.format(new Date(iso)); }

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
