'use client';

import { useDeferredValue, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, List, CheckCircle2 } from 'lucide-react';
import { useFeedbackAction } from '../components/useFeedbackAction';

const TEMPLATE_BODY = `Bom dia, Prezados!

Solicitamos, por gentileza, o envio da Nota Fiscal referente aos serviços prestados, com URGÊNCIA E PRIORIDADE ainda hoje, para que possamos dar continuidade aos procedimentos internos de conferência e pagamento.

Associação: {{associação}}
CNPJ: {{cnpj}}
Placa: {{placa}}
Protocolo {{protocolo}}
Modelo: {{modelo}}
Valor: {{valor}}
Data de atendimento: {{data}}

Ficamos no aguardo e à disposição para qualquer esclarecimento.`;

const DEFAULT_VARS = {
  'associação': 'Nacional Assistência',
  cnpj: '57.220.668/0001-61',
  placa: 'ABC1D23',
  protocolo: 'NO-260422075110',
  modelo: 'Toyota Hilux',
  valor: 'R$ 1.850,00',
  data: '18/04/2025',
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function TemplatesPage() {
  const [vars, setVars] = useState(DEFAULT_VARS);
  const varsDeferred = useDeferredValue(vars);
  const [buscaId, setBuscaId] = useState('');
  const [fetchResp, setFetchResp] = useState<unknown>(null);
  const [listagem, setListagem] = useState<unknown>(null);

  const carregar = useFeedbackAction(
    {
      loading: 'Buscando template…',
      success: 'Template carregado',
      error: 'Falha ao carregar template',
    },
    async () => {
      const id = buscaId.trim();
      if (!id) throw new Error('Informe um ID');
      const r = await fetch(`/api/atomos/templates/${encodeURIComponent(id)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.erro ?? `HTTP ${r.status}`);
      setFetchResp(data);
      setListagem(null);
      return data;
    },
  );

  const listar = useFeedbackAction(
    {
      loading: 'Listando templates…',
      success: 'Lista carregada',
      error: 'Falha ao listar templates',
    },
    async () => {
      const r = await fetch('/api/atomos/templates');
      const data = await r.json();
      if (!r.ok) throw new Error((data as { erro?: string })?.erro ?? `HTTP ${r.status}`);
      setListagem(data);
      setFetchResp(null);
      return data;
    },
  );

  const definirAtivo = useFeedbackAction(
    {
      loading: 'Definindo template ativo…',
      success: (id) => `Template "${id}" definido como ativo`,
      error: 'Falha ao definir template',
    },
    async () => {
      const id = buscaId.trim();
      if (!id) throw new Error('Informe um ID');
      const r = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ATOMOS_TEMPLATE_ID: id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.erro ?? `HTTP ${r.status}`);
      return id;
    },
  );

  const preview = TEMPLATE_BODY
    .replace('{{associação}}', varsDeferred['associação'] || '{{associação}}')
    .replace('{{cnpj}}',       varsDeferred.cnpj          || '{{cnpj}}')
    .replace('{{placa}}',      varsDeferred.placa         || '{{placa}}')
    .replace('{{protocolo}}',  varsDeferred.protocolo     || '{{protocolo}}')
    .replace('{{modelo}}',     varsDeferred.modelo        || '{{modelo}}')
    .replace('{{valor}}',      varsDeferred.valor         || '{{valor}}')
    .replace('{{data}}',       varsDeferred.data          || '{{data}}');

  const set = (k: keyof typeof vars) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVars((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="page-shell">
      <div className="mesh-hero mb-8">
        <motion.div
          className="text-[0.7rem] font-mono font-semibold uppercase tracking-[0.24em] text-accent dark:text-accent-soft mb-1"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          Biblioteca de mensagens
        </motion.div>
        <motion.h1
          className="font-serif text-5xl sm:text-6xl tracking-tight text-slate-900 dark:text-ivory-100 leading-none"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease }}
        >
          Templates
        </motion.h1>
        <motion.p
          className="mt-3 text-sm text-slate-500 dark:text-ivory-400 max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.18, ease }}
        >
          Visualize e simule o template ativo. Para alterar o texto da mensagem, crie um novo
          template no ÁtomosChat e obtenha aprovação da Meta.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* INFO DO TEMPLATE */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-ivory-100 mb-3">Template ativo</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Nome"       value="notafiscal" />
              <Row label="ID"         value="9664d_notafiscal" mono />
              <Row label="Categoria"  value="Utilidade" />
              <Row label="Status"     value="Ativo" badge="success" />
              <Row label="Remetente"  value="(81) 98625-8568 — Toda a empresa" />
            </dl>
            <p className="mt-4 text-xs text-slate-400 dark:text-ivory-500">
              Para trocar o template ativo, vá em{' '}
              <a href="/config" className="text-accent dark:text-accent-soft hover:underline">Configurações → Template ID</a>.
            </p>
          </div>

          {/* VARIÁVEIS PARA SIMULAÇÃO */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-ivory-100 mb-3">Simular com valores</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(DEFAULT_VARS) as (keyof typeof DEFAULT_VARS)[]).map((k) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-ivory-400 mb-1">{k}</label>
                  <input
                    className="form-input"
                    value={vars[k]}
                    onChange={set(k)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PREVIEW WhatsApp */}
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-ivory-100 mb-3">Preview da mensagem</h2>
          <div className="rounded-2xl bg-[#e5ddd5] dark:bg-deep-200 p-4 sm:p-6 min-h-[400px] flex items-start overflow-x-auto">
            <motion.div
              key={preview}
              initial={{ opacity: 0.4, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease }}
              className="bg-white rounded-xl rounded-tl-sm shadow-sm px-4 py-3 max-w-xs w-full text-sm text-[#111] leading-relaxed whitespace-pre-wrap font-sans"
            >
              {preview}
              <div className="text-right text-[10px] text-zinc-400 mt-2">09:00 ✓✓</div>
            </motion.div>
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-ivory-500 text-center">
            Preview ilustrativo — layout real pode variar por dispositivo
          </p>
        </div>

      </div>

      {/* BUSCAR/LISTAR TEMPLATES NA ATOMOS */}
      <div className="card mt-6">
        <h2 className="font-semibold text-slate-900 dark:text-ivory-100 mb-3">
          Buscar template na Atomos
        </h2>
        <p className="text-xs text-slate-500 dark:text-ivory-400 mb-3">
          Consulta o AtomosChat por ID ou lista todos os templates disponíveis. Útil pra trocar o
          template ativo sem mexer no <code className="bg-slate-100 dark:bg-deep-50 px-1 rounded font-mono">.env</code> manualmente.
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={buscaId}
            onChange={(e) => setBuscaId(e.target.value)}
            placeholder="ID do template (ex: 9664d_notafiscal)"
            className="form-input flex-1 min-w-[220px] font-mono text-xs"
          />
          <button onClick={() => carregar.run()} disabled={carregar.loading || !buscaId.trim()} className="btn-outline">
            <Download size={14} /> {carregar.loading ? 'Buscando…' : 'Carregar'}
          </button>
          <button
            onClick={() => definirAtivo.run()}
            disabled={definirAtivo.loading || !buscaId.trim()}
            className="btn-primary"
            title="Grava ATOMOS_TEMPLATE_ID no .env via API de config"
          >
            <CheckCircle2 size={14} /> {definirAtivo.loading ? 'Salvando…' : 'Definir como ativo'}
          </button>
          <button onClick={() => listar.run()} disabled={listar.loading} className="btn-outline">
            <List size={14} /> {listar.loading ? 'Listando…' : 'Listar todos'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {fetchResp != null && (
            <motion.div
              key="fetch"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease }}
              className="mt-3"
            >
              <h3 className="text-xs font-semibold text-slate-600 dark:text-ivory-200 mb-1.5">Resposta da Atomos (por ID):</h3>
              <pre className="bg-slate-900 dark:bg-black text-ivory-100 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed font-mono whitespace-pre max-h-72">
                {JSON.stringify(fetchResp, null, 2)}
              </pre>
            </motion.div>
          )}

          {listagem != null && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease }}
              className="mt-3"
            >
              <h3 className="text-xs font-semibold text-slate-600 dark:text-ivory-200 mb-1.5">Listagem:</h3>
              <pre className="bg-slate-900 dark:bg-black text-ivory-100 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed font-mono whitespace-pre max-h-72">
                {JSON.stringify(listagem, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CORPO DO TEMPLATE */}
      <div className="card mt-6">
        <h2 className="font-semibold text-slate-900 dark:text-ivory-100 mb-3">Corpo do template (texto original)</h2>
        <pre className="bg-slate-50 dark:bg-deep-200 border border-slate-200 dark:border-ivory-200/10 rounded-lg p-4 text-sm text-slate-700 dark:text-ivory-200 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
          {TEMPLATE_BODY}
        </pre>
        <p className="mt-3 text-xs text-slate-500 dark:text-ivory-400">
          As variáveis{' '}
          {['associação', 'cnpj', 'placa', 'protocolo', 'modelo', 'valor', 'data'].map((v, i, arr) => (
            <span key={v}>
              <code className="bg-slate-100 dark:bg-deep-50 px-1 rounded font-mono text-slate-700 dark:text-ivory-200">{`{{${v}}}`}</code>
              {i < arr.length - 2 ? ', ' : i === arr.length - 2 ? ' e ' : ''}
            </span>
          ))}{' '}
          são preenchidas automaticamente com os dados de cada atendimento da DevSul.
        </p>
      </div>
    </div>
  );
}

function Row({
  label, value, mono, badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: 'success' | 'warning';
}) {
  return (
    <div className="flex justify-between gap-3 items-center">
      <dt className="text-slate-500 dark:text-ivory-400">{label}</dt>
      <dd className={mono
        ? 'font-mono text-slate-800 dark:text-ivory-100 text-xs break-all text-right'
        : 'text-slate-800 dark:text-ivory-100 text-right'
      }>
        {badge ? (
          <span className={badge === 'success' ? 'badge-success' : 'badge-warning'}>{value}</span>
        ) : value}
      </dd>
    </div>
  );
}
