'use client';

import { useState } from 'react';

type EnvMap = Record<string, string>;

interface Props {
  initial: EnvMap;
}

export function ConfigClient({ initial }: Props) {
  const [env, setEnv] = useState<EnvMap>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ section: string; ok: boolean; text: string } | null>(null);

  async function saveSection(section: string, fields: Record<string, string>) {
    setSaving(section);
    setMsg(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? 'Erro desconhecido');
      setEnv((prev) => ({ ...prev, ...fields }));
      const salvos: string[] = json.salvos ?? [];
      const texto = salvos.length > 0
        ? `Salvo: ${salvos.join(', ')}`
        : 'Nenhuma alteração detectada.';
      setMsg({ section, ok: true, text: texto });
    } catch (e) {
      setMsg({ section, ok: false, text: (e as Error).message });
    } finally {
      setSaving(null);
    }
  }

  const field = (key: string) => env[key] ?? '';
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEnv((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="max-w-3xl space-y-6 page-shell">

      {/* OPERAÇÃO */}
      <Section
        title="Operação"
        badge={env['TEST_MODE'] === 'true' ? 'teste' : 'produção'}
        badgeTone={env['TEST_MODE'] === 'true' ? 'warning' : 'success'}
        saving={saving === 'operacao'}
        feedback={msg?.section === 'operacao' ? msg : null}
        onSave={() => saveSection('operacao', {
          TEST_MODE: field('TEST_MODE'),
          TEST_PHONE_NUMBER: field('TEST_PHONE_NUMBER'),
        })}
      >
        <FormRow label="Modo de teste">
          <select
            className="form-select"
            value={field('TEST_MODE')}
            onChange={set('TEST_MODE')}
          >
            <option value="true">Ativo — disparos vão para o número de teste</option>
            <option value="false">Produção — disparos vão para os prestadores reais</option>
          </select>
        </FormRow>
        <FormRow label="Número de teste" hint="E.164 sem '+' (ex: 5581999430696)">
          <input className="form-input" value={field('TEST_PHONE_NUMBER')} onChange={set('TEST_PHONE_NUMBER')} />
        </FormRow>
      </Section>

      {/* BUSCA DEVSUL */}
      <Section
        title="Busca DevSul"
        saving={saving === 'devsul'}
        feedback={msg?.section === 'devsul' ? msg : null}
        onSave={() => saveSection('devsul', {
          DEVSUL_LOOKBACK_DAYS: field('DEVSUL_LOOKBACK_DAYS'),
          DEVSUL_SITUACOES: field('DEVSUL_SITUACOES'),
        })}
      >
        <FormRow label="Janela (dias)" hint="Quantos dias atrás buscar atendimentos">
          <input className="form-input w-full sm:w-32" type="number" min={1} max={365} value={field('DEVSUL_LOOKBACK_DAYS')} onChange={set('DEVSUL_LOOKBACK_DAYS')} />
        </FormRow>
        <FormRow label="Situações DevSul" hint="Código de situação dos atendimentos (1282 = aguardando NF)">
          <input className="form-input" value={field('DEVSUL_SITUACOES')} onChange={set('DEVSUL_SITUACOES')} />
        </FormRow>
      </Section>

      {/* CONTROLE DE ENVIO */}
      <Section
        title="Controle de envio"
        saving={saving === 'envio'}
        feedback={msg?.section === 'envio' ? msg : null}
        onSave={() => saveSection('envio', {
          SEND_DELAY_MS: field('SEND_DELAY_MS'),
          MAX_SENDS_PER_RUN: field('MAX_SENDS_PER_RUN'),
        })}
      >
        <FormRow label="Delay entre envios (ms)" hint="Mínimo recomendado: 1000 ms (RF.05)">
          <input className="form-input w-full sm:w-32" type="number" min={500} step={500} value={field('SEND_DELAY_MS')} onChange={set('SEND_DELAY_MS')} />
        </FormRow>
        <FormRow label="Limite por rodada" hint="0 = sem limite. Use 1 para testes.">
          <input className="form-input w-full sm:w-32" type="number" min={0} value={field('MAX_SENDS_PER_RUN')} onChange={set('MAX_SENDS_PER_RUN')} />
        </FormRow>
      </Section>

      {/* AGENDAMENTO */}
      <Section
        title="Agendamento (Cron)"
        saving={saving === 'cron'}
        feedback={msg?.section === 'cron' ? msg : null}
        onSave={() => saveSection('cron', { CRON_SCHEDULE: field('CRON_SCHEDULE') })}
      >
        <FormRow label="Expressão cron" hint="Deixe vazio para desabilitar. Ex: 0 8 * * 1-5 = seg–sex às 08:00">
          <input className="form-input font-mono" placeholder="0 8 * * 1-5" value={field('CRON_SCHEDULE')} onChange={set('CRON_SCHEDULE')} />
        </FormRow>
        <div className="mt-2 flex flex-wrap gap-2">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.expr}
              className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => setEnv((prev) => ({ ...prev, CRON_SCHEDULE: p.expr }))}
            >
              {p.label}
            </button>
          ))}
          <button
            className="text-xs px-2 py-1 rounded border border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            onClick={() => setEnv((prev) => ({ ...prev, CRON_SCHEDULE: '' }))}
          >
            Desativar
          </button>
        </div>
      </Section>

      {/* CREDENCIAIS */}
      <Section
        title="Credenciais"
        saving={saving === 'cred'}
        feedback={msg?.section === 'cred' ? msg : null}
        onSave={() => saveSection('cred', {
          DEVSUL_BEARER_TOKEN: field('DEVSUL_BEARER_TOKEN'),
          ATOMOS_BEARER_TOKEN: field('ATOMOS_BEARER_TOKEN'),
          ATOMOS_CHANNEL_ID: field('ATOMOS_CHANNEL_ID'),
          ATOMOS_TEMPLATE_ID: field('ATOMOS_TEMPLATE_ID'),
        })}
      >
        <CredRow label="DevSul Bearer Token" envKey="DEVSUL_BEARER_TOKEN" env={env} setEnv={setEnv} />
        <CredRow label="Atomos Bearer Token" envKey="ATOMOS_BEARER_TOKEN" env={env} setEnv={setEnv} />
        <CredRow label="Atomos Channel ID" envKey="ATOMOS_CHANNEL_ID" env={env} setEnv={setEnv} />
        <FormRow label="Template ID" hint="ID do template ativo no ÁtomosChat">
          <input className="form-input font-mono" value={field('ATOMOS_TEMPLATE_ID')} onChange={set('ATOMOS_TEMPLATE_ID')} />
        </FormRow>
      </Section>

    </div>
  );
}

/* ── helpers ── */

const CRON_PRESETS = [
  { label: 'Seg–Sex 08:00', expr: '0 8 * * 1-5' },
  { label: 'Seg–Sex 09:00', expr: '0 9 * * 1-5' },
  { label: 'Todo dia 08:00', expr: '0 8 * * *' },
  { label: 'Segunda 08:00', expr: '0 8 * * 1' },
];

function Section({
  title, badge, badgeTone, saving, feedback, onSave, children,
}: {
  title: string;
  badge?: string;
  badgeTone?: 'warning' | 'success';
  saving: boolean;
  feedback: { ok: boolean; text: string } | null;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {badge && (
            <span className={badgeTone === 'warning' ? 'badge-warning' : 'badge-success'}>{badge}</span>
          )}
        </div>
        <button className="btn-primary text-sm py-1.5" disabled={saving} onClick={onSave}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <div className="space-y-4">{children}</div>
      {feedback && (
        <div className={`mt-3 text-sm rounded px-3 py-2 ${
          feedback.ok
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300'
        }`}>
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function CredRow({
  label, envKey, env, setEnv,
}: {
  label: string;
  envKey: string;
  env: EnvMap;
  setEnv: React.Dispatch<React.SetStateAction<EnvMap>>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const displayed = env[envKey] ?? '';
  const definido = displayed.length > 0 && !displayed.includes('não definido');

  function confirmar() {
    if (draft.trim()) {
      setEnv((prev) => ({ ...prev, [envKey]: draft.trim() }));
    }
    setEditing(false);
    setDraft('');
  }

  function cancelar() {
    setEditing(false);
    setDraft('');
  }

  return (
    <FormRow label={label}>
      {editing ? (
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <input
            autoFocus
            className="form-input flex-1 min-w-0 font-mono text-sm"
            type="text"
            placeholder="Cole o novo valor aqui"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') cancelar(); }}
          />
          <button className="btn-primary text-sm" disabled={!draft.trim()} onClick={confirmar}>OK</button>
          <button className="btn-outline text-sm" onClick={cancelar}>✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <code className={`text-sm flex-1 min-w-0 px-3 py-2 rounded-lg border truncate font-mono
            ${definido
              ? 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400'
              : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-500/20 text-rose-500'}`}>
            {displayed || '— não definido —'}
          </code>
          <button className="btn-outline text-sm shrink-0" onClick={() => setEditing(true)}>Editar</button>
        </div>
      )}
    </FormRow>
  );
}
