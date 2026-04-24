'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Zap } from 'lucide-react';
import { useSfx } from './components/SfxProvider';

interface RunResult {
  resumo: {
    total: number;
    processados: number;
    enviadosOk: number;
    falhas: number;
    testMode: boolean;
    destinoTeste: string | null;
  };
}

const ease = [0.16, 1, 0.3, 1] as const;
const AUTO_CLOSE_SECONDS = 8;

export function RunButton({ testMode, testPhone }: { testMode: boolean; testPhone: string }) {
  const router = useRouter();
  const { play } = useSfx();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<RunResult | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(AUTO_CLOSE_SECONDS);

  useEffect(() => {
    if (!resultado) return;
    setSegundosRestantes(AUTO_CLOSE_SECONDS);
    const interval = setInterval(() => {
      setSegundosRestantes(s => {
        if (s <= 1) {
          clearInterval(interval);
          setResultado(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resultado]);

  async function executar() {
    setConfirmOpen(false);
    setRodando(true);
    setResultado(null);
    play('click');
    const id = toast.loading('Enviando mensagens…', { description: 'Buscando atendimentos e disparando cobranças.' });
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? 'Erro desconhecido');
      setResultado(json as RunResult);
      play('success');
      const r = json.resumo;
      const descricao = r.falhas > 0
        ? `${r.enviadosOk} entregues · ${r.falhas} não entregues — veja no histórico.`
        : `${r.enviadosOk} mensagens entregues. Tudo certo!`;
      toast.success('Execução concluída', {
        id,
        description: descricao,
        duration: 10000,
        action: {
          label: 'Ver histórico',
          onClick: () => router.push('/historico'),
        },
      });
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      play('error');
      toast.error('Não foi possível executar', { id, description: msg, duration: 10000 });
    } finally {
      setRodando(false);
    }
  }

  function openConfirm() {
    play('open');
    setConfirmOpen(true);
  }

  return (
    <>
      <button
        data-run-now
        className="btn-primary group"
        disabled={rodando}
        onClick={openConfirm}
      >
        {rodando
          ? <><Loader2 size={14} className="animate-spin" /> Executando…</>
          : <><Zap size={14} className="transition-transform duration-300 ease-out-expo group-hover:rotate-12" /> Executar agora</>}
      </button>

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              className="card w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto shadow-elev-3"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="h-page">Confirmar execução</h3>
              <p className="mt-3 text-sm text-slate-700 dark:text-ivory-300">
                Vamos buscar os atendimentos dos últimos dias e enviar a mensagem de cobrança para cada prestador encontrado.
              </p>
              {testMode ? (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300">
                  <strong>Modo de teste ativo.</strong> Nenhum prestador real recebe. Tudo vai para{' '}
                  <span className="font-mono">{testPhone}</span>.
                </div>
              ) : (
                <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300">
                  <strong>Produção.</strong> As mensagens serão enviadas para os prestadores reais. Faremos um envio de teste antes, para conferir.
                </div>
              )}
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button className="btn-outline" onClick={() => { play('click'); setConfirmOpen(false); }}>Cancelar</button>
                <button className="btn-primary" onClick={executar}>Confirmar e executar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resultado && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setResultado(null)}
          >
            <motion.div
              className="card w-full max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto shadow-elev-3 relative"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.24, ease }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="h-page mb-4">Concluído!</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Stat label="Processados"    value={resultado.resumo.processados} />
                <Stat label="Total na fila"  value={resultado.resumo.total} />
                <Stat label="Entregues"      value={resultado.resumo.enviadosOk} tone="success" />
                <Stat label="Não entregues"  value={resultado.resumo.falhas} tone={resultado.resumo.falhas > 0 ? 'danger' : 'neutral'} />
              </div>
              {resultado.resumo.testMode && resultado.resumo.destinoTeste && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-3 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300">
                  Modo de teste — tudo foi para {resultado.resumo.destinoTeste}.
                </p>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <a href="/historico" className="btn-outline text-sm text-center">Ver histórico</a>
                <button className="btn-primary" onClick={() => { play('click'); setResultado(null); }}>
                  Fechar ({segundosRestantes}s)
                </button>
              </div>
              <motion.div
                key={resultado.resumo.processados}
                className="absolute bottom-0 left-0 h-0.5 bg-accent/60 dark:bg-accent-soft/60 rounded-b-2xl"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: AUTO_CLOSE_SECONDS, ease: 'linear' }}
                aria-hidden
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'success' | 'danger' | 'neutral' }) {
  const color = tone === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'danger'
    ? 'text-rose-600 dark:text-rose-400'
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
