import { format, subDays } from 'date-fns';
import { History as HistoryIcon, Settings2, Send, CheckCircle2, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { loadConfig } from '../src/config';
import { fetchAtendimentos } from '../src/devsul/client';
import { normalizarAtendimento } from '../src/mapper';
import { RunButton } from './run-button';
import { ChartDisparos, type DiaStats } from './chart-disparos';
import { prisma } from '../lib/db';
import { Hero } from './dashboard/Hero';
import { StatCard } from './dashboard/StatCard';
import { ActionCard } from './dashboard/ActionCard';
import { FadeIn } from './dashboard/FadeIn';
import { DevSulErrorCard } from './dashboard/DevSulErrorCard';
import { GLOSSARIO } from './dashboard/glossario';
import { InfoHint } from './components/InfoHint';
import { AutoRefresh } from './components/AutoRefresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function carregarGrafico(): Promise<DiaStats[]> {
  const inicio = subDays(new Date(), 13);
  const registros = await prisma.disparo.findMany({
    where: { createdAt: { gte: inicio } },
    select: { createdAt: true, ultimoStatus: true },
    orderBy: { createdAt: 'asc' },
  });

  const mapa = new Map<string, DiaStats>();
  for (let i = 0; i < 14; i++) {
    const d = subDays(new Date(), 13 - i);
    const key = format(d, 'dd/MM');
    mapa.set(key, { label: key, dataISO: format(d, 'yyyy-MM-dd'), total: 0, ok: 0, falha: 0, queued: 0 });
  }

  for (const r of registros) {
    const key = format(r.createdAt, 'dd/MM');
    const dia = mapa.get(key);
    if (!dia) continue;
    dia.total++;
    if (['DELIVERED', 'READ', 'SENT'].includes(r.ultimoStatus)) dia.ok++;
    else if (['FAILED', 'ERROR'].includes(r.ultimoStatus)) dia.falha++;
    else dia.queued++;
  }

  return Array.from(mapa.values());
}

async function carregarDados() {
  const cfg = loadConfig();
  const hoje = new Date();
  const inicio = subDays(hoje, cfg.DEVSUL_LOOKBACK_DAYS);

  let atendimentos: unknown[] = [];
  let erro: string | null = null;
  try {
    atendimentos = await fetchAtendimentos({
      DataInicial: format(inicio, 'yyyy-MM-dd'),
      DataFinal: format(hoje, 'yyyy-MM-dd'),
      Situacoes: cfg.DEVSUL_SITUACOES,
    });
  } catch (e) {
    erro = (e as Error).message;
  }

  let mapeaveis = 0;
  let ignorados = 0;
  let somaValor = 0;
  for (const a of atendimentos) {
    const n = normalizarAtendimento(a as Record<string, unknown>);
    if (n) {
      mapeaveis++;
      somaValor += n.valor;
    } else {
      ignorados++;
    }
  }

  return {
    cfg,
    total: atendimentos.length,
    mapeaveis,
    ignorados,
    somaValor,
    erro,
  };
}

export default async function Dashboard() {
  const [d, grafico] = await Promise.all([
    carregarDados().catch((e: unknown) => ({
      cfg: loadConfig(),
      total: 0, mapeaveis: 0, ignorados: 0, somaValor: 0,
      erro: (e as Error).message,
    })),
    carregarGrafico().catch(() => [] as DiaStats[]),
  ]);

  const totalGrafico = grafico.reduce((s, d) => s + d.total, 0);
  const okGrafico    = grafico.reduce((s, d) => s + d.ok, 0);
  const sucessoPct   = totalGrafico > 0 ? (okGrafico / totalGrafico) * 100 : 0;

  return (
    <div className="page-shell">
      <Hero
        lookbackDias={d.cfg.DEVSUL_LOOKBACK_DAYS}
        mapeaveis={d.mapeaveis}
        testMode={d.cfg.TEST_MODE}
      >
        <RunButton testMode={d.cfg.TEST_MODE} testPhone={d.cfg.TEST_PHONE_NUMBER} />
      </Hero>

      {d.erro && (
        <FadeIn delay={80} className="mb-6">
          <DevSulErrorCard mensagem={d.erro} />
        </FadeIn>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <StatCard
          label="Prontos para cobrar"
          icon={<CheckCircle2 />}
          value={d.mapeaveis}
          hint={`de ${d.total} atendimentos encontrados`}
          help={GLOSSARIO.prontosCobrar}
          tone="success"
          delay={0}
        />
        <StatCard
          label="Valor total a cobrar"
          icon={<DollarSign />}
          value={d.somaValor}
          hint="soma dos prontos"
          help={GLOSSARIO.valorTotal}
          format="brl"
          delay={80}
        />
        <StatCard
          label="Não foi possível cobrar"
          icon={<AlertCircle />}
          value={d.ignorados}
          hint="sem telefone ou associação"
          help={GLOSSARIO.naoPodeCobrar}
          tone="warning"
          delay={160}
        />
        <StatCard
          label="Taxa de entrega (14 dias)"
          icon={<TrendingUp />}
          value={sucessoPct}
          hint={`${okGrafico} de ${totalGrafico} entregues`}
          help={GLOSSARIO.taxaSucesso}
          format="pct"
          delay={240}
        />
      </div>

      <FadeIn delay={200} className="mb-8 sm:mb-10">
        <div className="card">
          <ChartDisparos dias={grafico} />
        </div>
      </FadeIn>

      <section className="mb-8 sm:mb-10">
        <FadeIn delay={280}>
          <h2 className="h-section mb-3 sm:mb-4">O que você quer fazer?</h2>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <ActionCard
            variant="primary"
            href="/disparos"
            icon={<Send />}
            title="Revisar e enviar cobranças"
            desc="Escolha quais atendimentos receberão a mensagem e envie agora, acompanhando tudo em tempo real."
            delay={300}
          />
          <ActionCard
            href="/historico"
            icon={<HistoryIcon size={18} />}
            title="Acompanhar envios"
            desc="Veja o status de cada cobrança, exporte planilhas e reconsulte pendentes."
            delay={360}
          />
          <ActionCard
            href="/config"
            icon={<Settings2 size={18} />}
            title="Ajustar configurações"
            desc="Número de teste, quantos dias olhar, pausa entre mensagens e execução automática."
            delay={420}
          />
        </div>
      </section>

      <AutoRefresh intervalMs={180_000} />

      <FadeIn delay={460}>
        <div className="card">
          <h2 className="h-section mb-3 sm:mb-4">Configuração atual</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 sm:gap-y-4 text-sm">
            <Row label="Número de teste" value={d.cfg.TEST_PHONE_NUMBER} />
            <Row
              label="Quantos dias pra trás olhamos"
              value={`${d.cfg.DEVSUL_LOOKBACK_DAYS} dia${d.cfg.DEVSUL_LOOKBACK_DAYS === 1 ? '' : 's'}`}
              help={GLOSSARIO.janela}
            />
            <Row label="Pausa entre mensagens" value={`${d.cfg.SEND_DELAY_MS} ms`} />
            <Row
              label="Máximo por execução"
              value={d.cfg.MAX_SENDS_PER_RUN === 0 ? 'sem limite' : String(d.cfg.MAX_SENDS_PER_RUN)}
            />
            <Row
              label="Execução automática"
              value={d.cfg.CRON_SCHEDULE || 'Desligada — só roda quando você clica'}
            />
            <Row
              label="Filtro de situação"
              value={d.cfg.DEVSUL_SITUACOES}
              help={GLOSSARIO.situacao}
            />
          </dl>
        </div>
      </FadeIn>
    </div>
  );
}

function Row({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="flex flex-col gap-0.5 md:flex-row md:items-start md:justify-between md:gap-3 min-w-0">
      <dt className="flex items-center gap-1.5 min-w-0
                     text-[0.65rem] uppercase tracking-wider font-mono font-semibold text-slate-500 dark:text-ivory-500
                     md:text-sm md:normal-case md:tracking-normal md:font-sans md:font-normal md:text-slate-600 md:dark:text-ivory-400
                     md:shrink-0">
        <span className="break-words">{label}</span>
        {help && <InfoHint label={label}>{help}</InfoHint>}
      </dt>
      <dd className="font-mono text-sm text-slate-900 dark:text-ivory-200 break-all min-w-0
                     md:text-right">
        {value}
      </dd>
    </div>
  );
}
