import { format, parseISO, subDays } from 'date-fns';
import { loadConfig } from '../src/config';
import { fetchAtendimentos } from '../src/devsul/client';
import { getCnpjPorRegional } from '../src/devsul/regionais';
import { normalizarAtendimento, normalizarParcial, type AtendimentoNormalizado } from '../src/mapper';

export interface AtendimentoView {
  id: string;
  placa: string;
  modelo: string;
  valor: number;
  valorFmt: string;
  dataISO: string;     // YYYY-MM-DD (usado em filtros)
  dataFmt: string;     // DD/MM/YYYY (exibição)
  telefone: string;    // E.164 sem "+" — já sanitizado
  telefoneMask: string; // mascarado para exibição na UI
  prestador: string;
  associacao: string;
  cnpj: string;
  protocolo: string;
  raw: Record<string, unknown>; // atendimento bruto da DevSul (audit)
  mapeavel: true;
}

export interface AtendimentoIgnorado {
  id: string;
  placa: string;
  modelo: string;
  valor: number | null;
  valorFmt: string;
  dataFmt: string;
  dataISO: string;
  prestador: string;
  associacao: string;
  cnpj: string;
  protocolo: string;
  motivo: 'sem_telefone' | 'outro';
  mapeavel: false;
}

export type AtendimentoItem = AtendimentoView | AtendimentoIgnorado;

export interface CarregarResultado {
  itens: AtendimentoItem[];
  mapeaveis: AtendimentoView[];
  ignorados: AtendimentoIgnorado[];
  total: number;
  somaValor: number;
  janelaInicio: string;
  janelaFim: string;
  erro: string | null;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function mascararTelefone(tel: string): string {
  if (!tel) return '';
  const d = tel.slice(-4);
  return `•••••••${d}`;
}

function toView(n: AtendimentoNormalizado, cnpjMap: Map<string, string>): AtendimentoView {
  const cnpjResolvido = n.cnpj || cnpjMap.get(n.associacao) || '';
  return {
    id: n.id,
    placa: n.placa,
    modelo: n.modelo,
    valor: n.valor,
    valorFmt: fmtBRL(n.valor),
    dataISO: format(n.dataAtendimento, 'yyyy-MM-dd'),
    dataFmt: format(n.dataAtendimento, 'dd/MM/yyyy'),
    telefone: n.telefone,
    telefoneMask: mascararTelefone(n.telefone),
    prestador: n.prestador ?? '',
    associacao: n.associacao,
    cnpj: cnpjResolvido,
    protocolo: n.protocolo,
    raw: n.raw as Record<string, unknown>,
    mapeavel: true,
  };
}

export async function carregarAtendimentos(opts?: {
  dataInicial?: string; // YYYY-MM-DD
  dataFinal?: string;   // YYYY-MM-DD
}): Promise<CarregarResultado> {
  const cfg = loadConfig();
  const hoje = new Date();
  const inicio = opts?.dataInicial ? parseISO(opts.dataInicial) : subDays(hoje, cfg.DEVSUL_LOOKBACK_DAYS);
  const fim    = opts?.dataFinal   ? parseISO(opts.dataFinal)   : hoje;
  const janelaInicio = format(inicio, 'dd/MM/yyyy');
  const janelaFim    = format(fim,    'dd/MM/yyyy');

  let brutos: Record<string, unknown>[] = [];
  let erro: string | null = null;
  try {
    const list = await fetchAtendimentos({
      DataInicial: format(inicio, 'yyyy-MM-dd'),
      DataFinal:   format(fim,   'yyyy-MM-dd'),
      Situacoes:   cfg.DEVSUL_SITUACOES,
    });
    brutos = list as Record<string, unknown>[];
  } catch (e) {
    erro = (e as Error).message;
  }

  const cnpjMap = await getCnpjPorRegional();

  const mapeaveis: AtendimentoView[] = [];
  const ignorados: AtendimentoIgnorado[] = [];
  let somaValor = 0;
  const itens: AtendimentoItem[] = [];

  for (const b of brutos) {
    const n = normalizarAtendimento(b);
    if (n) {
      const v = toView(n, cnpjMap);
      mapeaveis.push(v);
      itens.push(v);
      somaValor += n.valor;
    } else {
      const semTel = !b.FornecedorTelefones;
      const parcial = normalizarParcial(b);
      const cnpjResolvido = parcial.cnpj || cnpjMap.get(parcial.associacao) || '';
      const i: AtendimentoIgnorado = {
        id: parcial.id || String(b.Id ?? b.id ?? 'sem-id'),
        placa: parcial.placa || String(b.Placa ?? ''),
        modelo: parcial.modelo || String(b.Modelo ?? ''),
        valor: parcial.valor,
        valorFmt: parcial.valor != null ? fmtBRL(parcial.valor) : '—',
        dataFmt: parcial.dataAtendimento ? format(parcial.dataAtendimento, 'dd/MM/yyyy') : '—',
        dataISO: parcial.dataAtendimento ? format(parcial.dataAtendimento, 'yyyy-MM-dd') : '',
        prestador: parcial.prestador,
        associacao: parcial.associacao,
        cnpj: cnpjResolvido,
        protocolo: parcial.protocolo,
        motivo: semTel ? 'sem_telefone' : 'outro',
        mapeavel: false,
      };
      ignorados.push(i);
      itens.push(i);
    }
  }

  return {
    itens,
    mapeaveis,
    ignorados,
    total: brutos.length,
    somaValor,
    janelaInicio,
    janelaFim,
    erro,
  };
}

export async function carregarPorIds(ids: string[]): Promise<AtendimentoView[]> {
  const { mapeaveis } = await carregarAtendimentos();
  const set = new Set(ids);
  return mapeaveis.filter((m) => set.has(m.id));
}
