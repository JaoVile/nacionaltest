'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Send, Zap } from 'lucide-react';
import type { AtendimentoView, AtendimentoIgnorado } from '../../lib/atendimentos';
import { DisparoLive, type LiveEstado, type LiveEvento } from './disparo-live';
import { TemplatePreview } from './TemplatePreview';
import { AnimatedModal } from '../components/AnimatedModal';
import { InfoHint } from '../components/InfoHint';
import { GLOSSARIO } from '../dashboard/glossario';

interface Props {
  mapeaveis: AtendimentoView[];
  ignorados: AtendimentoIgnorado[];
  testMode: boolean;
  testPhone: string;
  templateLinhas: string[];
  dataInicial: string;
  dataFinal: string;
  janelaInicio: string;
  janelaFim: string;
}

interface DisparoResultado {
  atendimentoId: string;
  placa: string;
  destinoReal: string;
  destinoEfetivo: string;
  ok: boolean;
  messageId: string | null;
  status: string | null;
  failureReason: string | null;
  error?: string;
}

interface DisparoResponse {
  resumo: {
    selecionados: number;
    encontrados: number;
    naoEncontrados: string[];
    enviadosOk: number;
    falhas: number;
    testMode: boolean;
    destinoTeste: string | null;
  };
  resultados: DisparoResultado[];
}

const ease = [0.16, 1, 0.3, 1] as const;

export function DisparosClient({
  mapeaveis,
  ignorados,
  testMode,
  testPhone,
  templateLinhas,
  dataInicial,
  dataFinal,
  janelaInicio,
  janelaFim,
}: Props) {
  const router = useRouter();
  const [periodoStart, setPeriodoStart] = useState(dataInicial);
  const [periodoEnd, setPeriodoEnd] = useState(dataFinal);
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [foneEditando, setFoneEditando] = useState<string | null>(null);
  const [foneInput, setFoneInput] = useState('');
  const [manuais, setManuais] = useState<AtendimentoView[]>([]);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState<DisparoResponse | null>(null);
  const [liveEstado, setLiveEstado] = useState<LiveEstado>({
    fase: 'idle', total: 0, current: 0, eventos: [],
  });
  const abortCtrlRef = useRef<AbortController | null>(null);

  function buscarPeriodo() {
    const p = new URLSearchParams();
    if (periodoStart) p.set('dataInicial', periodoStart);
    if (periodoEnd)   p.set('dataFinal',   periodoEnd);
    router.push(`/disparos?${p.toString()}`);
  }

  const filtrados = useMemo(() => {
    const todos = [...mapeaveis, ...manuais];
    const q = buscaDeferred.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((a) =>
      [a.placa, a.modelo, a.prestador, a.id].some((c) => c.toLowerCase().includes(q)),
    );
  }, [buscaDeferred, mapeaveis, manuais]);

  function adicionarManual(ig: AtendimentoIgnorado, telefone: string) {
    const digits = telefone.replace(/\D/g, '');
    const tel = digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
    const view: AtendimentoView = {
      id: ig.id,
      placa: ig.placa,
      modelo: ig.modelo,
      valor: ig.valor ?? 0,
      valorFmt: ig.valorFmt,
      dataISO: ig.dataISO,
      dataFmt: ig.dataFmt,
      telefone: tel,
      telefoneMask: `manual: •••${digits.slice(-4)}`,
      prestador: ig.prestador,
      associacao: ig.associacao,
      cnpj: ig.cnpj,
      protocolo: ig.protocolo,
      raw: { manual: true, telefoneInformado: tel },
      mapeavel: true,
    };
    setManuais((prev) => [...prev.filter((m) => m.id !== ig.id), view]);
    setSelecionados((prev) => new Set([...prev, ig.id]));
    setFoneEditando(null);
    setFoneInput('');
  }

  const todosSelecionados = filtrados.length > 0 && filtrados.every((a) => selecionados.has(a.id));
  const toggleTodos = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosSelecionados) filtrados.forEach((a) => next.delete(a.id));
      else filtrados.forEach((a) => next.add(a.id));
      return next;
    });
  };
  const toggleUm = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const atendimentoPreview = [...mapeaveis, ...manuais].find((a) => a.id === previewId) ?? null;

  function cancelarDisparo() {
    abortCtrlRef.current?.abort();
  }

  async function executarDisparo() {
    setConfirmOpen(false);
    setDisparando(true);
    setResultado(null);
    const faseInicial: LiveEstado['fase'] = testMode ? 'sending' : 'testing';
    setLiveEstado({ fase: faseInicial, total: 0, current: 0, eventos: [] });

    const manuaisIds = new Set(manuais.map((m) => m.id));
    const ids = Array.from(selecionados).filter((id) => !manuaisIds.has(id));
    const manuaisSel = manuais.filter((m) => selecionados.has(m.id));

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    try {
      const res = await fetch('/api/disparos/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, manuais: manuaisSel }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error('Sem stream na resposta');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(dataLine.slice(6)) as Record<string, unknown>; }
          catch { continue; }

          if (ev.type === 'fatal') {
            setLiveEstado((s) => ({ ...s, fase: 'error', fatalMsg: String(ev.message ?? '') }));
            break;
          }
          if (ev.type === 'start')       setLiveEstado((s) => ({ ...s, total: Number(ev.total) }));
          if (ev.type === 'gate-start')  setLiveEstado((s) => ({ ...s, fase: 'testing' }));
          if (ev.type === 'gate-passed') setLiveEstado((s) => ({ ...s, fase: 'sending', countdown: undefined }));
          if (ev.type === 'countdown') {
            setLiveEstado((s) => ({
              ...s, fase: 'countdown',
              countdown: { remaining: Number(ev.remaining), total: Number(ev.total) },
            }));
          }
          if (ev.type === 'sending' || ev.type === 'testing') {
            const evento = ev as unknown as LiveEvento;
            setLiveEstado((s) => ({
              ...s,
              fase: ev.type === 'testing' ? 'testing' : 'sending',
              current: evento.current,
              eventos: [
                ...s.eventos.filter((e) => !((e.type === 'sending' || e.type === 'testing') && e.placa === evento.placa)),
                evento,
              ],
            }));
          }
          if (ev.type === 'result' || ev.type === 'test-result') {
            const evento = ev as unknown as LiveEvento;
            setLiveEstado((s) => ({
              ...s, current: evento.current,
              eventos: [
                ...s.eventos.filter((e) => !((e.type === 'sending' || e.type === 'testing') && e.placa === evento.placa)),
                evento,
              ],
            }));
          }
          if (ev.type === 'canceled') setLiveEstado((s) => ({ ...s, fase: 'canceled', abortMsg: String(ev.reason ?? '') }));
          if (ev.type === 'aborted')  setLiveEstado((s) => ({ ...s, fase: 'aborted',  abortMsg: String(ev.reason ?? '') }));
          if (ev.type === 'done') {
            const resumoFinal: DisparoResponse['resumo'] = {
              selecionados: Number(ev.total),
              encontrados: Number(ev.total),
              naoEncontrados: [],
              enviadosOk: Number(ev.enviadosOk),
              falhas: Number(ev.falhas),
              testMode: Boolean(ev.testMode),
              destinoTeste: (ev.destinoTeste as string | null) ?? null,
            };
            setLiveEstado((s) => ({ ...s, fase: 'done' }));
            setResultado({ resumo: resumoFinal, resultados: [] });
          }
        }
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        setLiveEstado((s) => ({
          ...s,
          fase: s.fase === 'canceled' || s.fase === 'aborted' ? s.fase : 'canceled',
          abortMsg: s.abortMsg ?? 'Cancelado pelo usuário',
        }));
      } else {
        setLiveEstado((s) => ({ ...s, fase: 'error', fatalMsg: err.message }));
      }
    } finally {
      setDisparando(false);
      abortCtrlRef.current = null;
    }
  }

  return (
    <>
      {/* SELETOR DE PERÍODO */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-ivory-200">Quais atendimentos buscar:</span>
          <input
            type="date"
            className="form-input w-full sm:w-40"
            value={periodoStart}
            onChange={(e) => setPeriodoStart(e.target.value)}
            aria-label="Data inicial"
          />
          <span className="text-slate-400 dark:text-ivory-500 text-sm">até</span>
          <input
            type="date"
            className="form-input w-full sm:w-40"
            value={periodoEnd}
            onChange={(e) => setPeriodoEnd(e.target.value)}
            aria-label="Data final"
          />
          <button className="btn-outline text-sm" onClick={buscarPeriodo}>Buscar</button>
          <span className="text-xs text-slate-400 dark:text-ivory-500 ml-auto font-mono tabular-nums">
            {janelaInicio} → {janelaFim} · {mapeaveis.length} encontrados
          </span>
        </div>
      </div>

      {/* FILTROS E AÇÕES */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ivory-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por placa, modelo ou prestador…"
              className="form-input pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar atendimentos"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-ivory-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarIgnorados}
              onChange={(e) => setMostrarIgnorados(e.target.checked)}
              className="accent-accent"
            />
            Mostrar atendimentos sem dados ({ignorados.length})
            <InfoHint label="Atendimentos sem dados">{GLOSSARIO.mostrarIgnorados}</InfoHint>
          </label>
          <div className="text-sm text-slate-500 dark:text-ivory-400 tabular-nums">
            <span className="font-mono font-semibold text-slate-900 dark:text-ivory-100">{selecionados.size}</span>
            {' '}selecionado{selecionados.size === 1 ? '' : 's'} de {filtrados.length}
          </div>
          <button
            data-run-now
            className="btn-primary w-full sm:w-auto group"
            disabled={selecionados.size === 0 || disparando}
            onClick={() => setConfirmOpen(true)}
          >
            <Send size={13} className="transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5" />
            {disparando
              ? 'Enviando…'
              : selecionados.size > 0
                ? `Enviar para ${selecionados.size}`
                : 'Enviar cobranças'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_380px] gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/90 dark:bg-deep-200/80 backdrop-blur sticky top-0 z-10 border-b border-slate-200 dark:border-ivory-200/10">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} className="accent-accent" />
                  </th>
                  <th className="px-3 py-2.5 text-left text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-ivory-400">Placa</th>
                  <th className="px-3 py-2.5 text-left text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-ivory-400 hidden sm:table-cell">Modelo</th>
                  <th className="px-3 py-2.5 text-right text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-ivory-400">Valor</th>
                  <th className="px-3 py-2.5 text-left text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-ivory-400 hidden md:table-cell">Data</th>
                  <th className="px-3 py-2.5 text-left text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-ivory-400 hidden lg:table-cell">Prestador</th>
                  <th className="px-3 py-2.5 text-left text-[0.6rem] font-mono font-semibold uppercase tracking-widest text-slate-500 dark:text-ivory-400 hidden sm:table-cell">Telefone</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtrados.map((a) => {
                    const selecionado = selecionados.has(a.id);
                    const ativo = previewId === a.id;
                    return (
                      <motion.tr
                        key={a.id}
                        layoutId={a.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22, ease }}
                        className={`border-b border-slate-100 dark:border-ivory-200/[0.05]
                                    cursor-pointer hover:bg-slate-50 dark:hover:bg-ivory-200/[0.03] transition-colors
                                    ${ativo ? 'bg-accent/5 dark:bg-accent-deep/15' : ''}`}
                        onClick={() => setPreviewId(a.id)}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selecionado} onChange={() => toggleUm(a.id)} className="accent-accent" />
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 dark:text-ivory-100">{a.placa}</td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-ivory-200 truncate max-w-[260px] hidden sm:table-cell" title={a.modelo}>
                          {a.modelo}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-ivory-200">{a.valorFmt}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums hidden md:table-cell text-slate-700 dark:text-ivory-200">{a.dataFmt}</td>
                        <td className="px-3 py-2.5 truncate max-w-[180px] hidden lg:table-cell text-slate-700 dark:text-ivory-200" title={a.prestador}>
                          {a.prestador}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-ivory-500 hidden sm:table-cell">{a.telefoneMask}</td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>

                {mostrarIgnorados &&
                  ignorados.filter((i) => !manuais.some((m) => m.id === i.id)).map((i) => (
                    <tr key={i.id} className="border-b border-slate-100 dark:border-ivory-200/[0.05] bg-amber-50/50 dark:bg-amber-500/[0.06]">
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-ivory-200">{i.placa || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-ivory-500 hidden sm:table-cell">{i.modelo || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-ivory-500">{i.valorFmt}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-500 dark:text-ivory-500 hidden md:table-cell">{i.dataFmt}</td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-ivory-500 hidden lg:table-cell">{i.prestador || '—'}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        {foneEditando === i.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              type="tel"
                              className="form-input w-40 text-xs"
                              placeholder="DDD + número (ex: 81999990000)"
                              value={foneInput}
                              onChange={(e) => setFoneInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && foneInput.trim()) adicionarManual(i, foneInput.trim());
                                if (e.key === 'Escape') { setFoneEditando(null); setFoneInput(''); }
                              }}
                            />
                            <button className="btn-primary text-xs py-1 px-2" disabled={!foneInput.trim()} onClick={() => adicionarManual(i, foneInput.trim())}>OK</button>
                            <button className="btn-outline text-xs py-1 px-2" onClick={() => { setFoneEditando(null); setFoneInput(''); }}>✕</button>
                          </div>
                        ) : (
                          <button className="text-xs text-accent dark:text-accent-soft hover:underline" onClick={() => { setFoneEditando(i.id); setFoneInput(''); }}>
                            + Adicionar telefone
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                {filtrados.length === 0 && !mostrarIgnorados && (
                  <tr>
                    <td colSpan={7} className="px-3 py-16 text-center text-slate-500 dark:text-ivory-400">
                      Nenhum atendimento corresponde ao filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <motion.aside
          className="card"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease }}
        >
          <h2 className="h-section mb-3">Como vai ficar a mensagem</h2>
          <AnimatePresence mode="wait">
            {atendimentoPreview ? (
              <motion.div key={atendimentoPreview.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease }}>
                <PreviewMensagem a={atendimentoPreview} linhas={templateLinhas} testMode={testMode} testPhone={testPhone} />
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-slate-500 dark:text-ivory-400">
                Clique em uma linha da tabela para ver a mensagem completa, já com os dados do prestador preenchidos.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.aside>
      </div>

      <AnimatedModal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar envio">
        <p className="text-sm text-slate-700 dark:text-ivory-200">
          Você vai enviar <strong className="tabular-nums">{selecionados.size}</strong> mensagem{selecionados.size === 1 ? '' : 's'} de cobrança de Nota Fiscal.
        </p>
        {testMode ? (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-300">
            <strong>Modo de teste ativo.</strong> Nenhum prestador real recebe — tudo vai para{' '}
            <span className="font-mono">{testPhone}</span>.
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-300">
            <strong>Produção.</strong> As mensagens vão para os prestadores reais. Faremos um envio de teste antes — se der certo, esperamos 15 segundos e mandamos todas.
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button className="btn-outline" onClick={() => setConfirmOpen(false)}>Cancelar</button>
          <button className="btn-primary" onClick={executarDisparo}>
            <Zap size={13} /> Confirmar e enviar
          </button>
        </div>
      </AnimatedModal>

      <AnimatedModal
        open={!!(resultado && liveEstado.fase === 'done')}
        onClose={() => {
          setResultado(null);
          setSelecionados(new Set());
          setLiveEstado({ fase: 'idle', total: 0, current: 0, eventos: [] });
        }}
        title="Concluído!"
        maxWidth="max-w-2xl"
      >
        {resultado && <ResultadoBody resumo={resultado.resumo} />}
      </AnimatedModal>

      <DisparoLive
        estado={liveEstado}
        onClose={() => setLiveEstado({ fase: 'idle', total: 0, current: 0, eventos: [] })}
        onCancel={cancelarDisparo}
      />

      {(() => {
        const ult = [...liveEstado.eventos].reverse().find((e) => e.values);
        if (!ult || liveEstado.fase === 'idle') return null;
        return (
          <TemplatePreview
            linhas={templateLinhas}
            values={(ult.values as Record<string, string>) ?? null}
            placa={ult.placa ?? null}
            destinoEfetivo={ult.destinoEfetivo ?? null}
            testMode={!!ult.testMode}
            current={liveEstado.current}
            total={liveEstado.total}
          />
        );
      })()}
    </>
  );
}

function PreviewMensagem({
  a, linhas, testMode, testPhone,
}: {
  a: AtendimentoView;
  linhas: string[];
  testMode: boolean;
  testPhone: string;
}) {
  const substituir = (linha: string) =>
    linha
      .replace('{{associação}}', a.associacao || '—')
      .replace('{{cnpj}}',       a.cnpj       || '—')
      .replace('{{placa}}',      a.placa)
      .replace('{{protocolo}}',  a.protocolo ? `NO-${a.protocolo}` : '—')
      .replace('{{modelo}}',     a.modelo)
      .replace('{{valor}}',      a.valorFmt)
      .replace('{{data}}',       a.dataFmt);

  return (
    <div>
      <div className="mb-3 text-xs text-slate-500 dark:text-ivory-400 space-y-1">
        <div>
          <span className="font-semibold text-slate-700 dark:text-ivory-200">Para:</span>{' '}
          <span className="font-mono">{testMode ? testPhone : a.telefone}</span>
          {testMode && <span className="ml-1.5 badge-warning">Teste</span>}
        </div>
        <details>
          <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-ivory-200 select-none">
            Ver ID do atendimento
          </summary>
          <div className="mt-1 font-mono break-all text-[11px]">{a.id}</div>
        </details>
      </div>
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm font-sans whitespace-pre-wrap leading-relaxed
                      dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-100">
        {linhas.map(substituir).join('\n')}
      </div>
    </div>
  );
}

function ResultadoBody({ resumo }: { resumo: DisparoResponse['resumo'] }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Selecionados"   value={resumo.selecionados} />
        <Stat label="Entregues"      value={resumo.enviadosOk} tone="success" />
        <Stat label="Não entregues"  value={resumo.falhas} tone={resumo.falhas > 0 ? 'danger' : 'neutral'} />
      </div>
      {resumo.testMode && resumo.destinoTeste && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 mb-3
                       dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-300">
          Modo de teste — tudo foi para {resumo.destinoTeste}.
        </p>
      )}
    </>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'success' | 'danger' | 'neutral' }) {
  const color =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'danger' ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-900 dark:text-ivory-100';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="rounded-lg bg-slate-50 border border-slate-200 p-3 dark:bg-deep-200 dark:border-ivory-200/10"
    >
      <div className="text-xs text-slate-500 dark:text-ivory-400 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-3xl font-black tabular-nums ${color}`}>{value}</div>
    </motion.div>
  );
}
