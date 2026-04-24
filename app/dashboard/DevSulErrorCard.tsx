'use client';

import Link from 'next/link';
import { CloudOff, RefreshCw, Settings2 } from 'lucide-react';

interface Props {
  mensagem: string;
}

export function DevSulErrorCard({ mensagem }: Props) {
  return (
    <div className="card border-rose-200 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-rose-100 text-rose-600
                        dark:bg-rose-500/15 dark:text-rose-400
                        flex items-center justify-center">
          <CloudOff size={24} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="h-section !text-rose-900 dark:!text-rose-200">
            Não consegui falar com o sistema de atendimentos
          </h3>
          <p className="mt-1 text-sm text-rose-800/90 dark:text-rose-200/80 max-w-2xl">
            Isso pode acontecer se a internet caiu, o sistema da DevSul saiu do ar ou a
            senha mudou. Chame o administrador ou tente de novo em alguns minutos. Você
            ainda pode disparar mensagens manualmente.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              <RefreshCw size={14} aria-hidden />
              Tentar de novo
            </button>
            <Link href="/config" className="btn-outline">
              <Settings2 size={14} aria-hidden />
              Abrir configurações
            </Link>
            <Link href="/disparos" className="btn-ghost">
              Ir para Disparos
            </Link>
          </div>
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer text-rose-700/80 dark:text-rose-300/70 hover:text-rose-900 dark:hover:text-rose-200 select-none">
              Detalhes técnicos (para o admin)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-rose-800/80 dark:text-rose-300/70 bg-rose-100/50 dark:bg-rose-500/10 rounded-lg p-3">
              {mensagem}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
