import type { AtendimentoView } from './atendimentos';
import type { DisparoRow } from '../app/historico/historico-client';

/**
 * Tipo padronizado consumido pelo `ResumoPainel`.
 * Adapters convertem cada fonte (atendimento DevSul / disparo Prisma) pra esse shape.
 */
export interface ItemResumo {
  id: string;
  placa: string;
  prestador: string;
  associacao: string;
  cnpj: string;
  valor: number;
  valorFmt: string;
  telefone: string;
  dataAtendimento: string; // ISO
  dataFmt: string;         // pt-BR DD/MM/YYYY
  /** Só presente em /historico */
  status?: string;
}

export function itemFromAtendimento(a: AtendimentoView): ItemResumo {
  return {
    id: a.id,
    placa: a.placa,
    prestador: a.prestador || '',
    associacao: a.associacao || '',
    cnpj: a.cnpj || '',
    valor: a.valor,
    valorFmt: a.valorFmt,
    telefone: a.telefone,
    dataAtendimento: a.dataISO,
    dataFmt: a.dataFmt,
  };
}

export function itemFromDisparo(d: DisparoRow): ItemResumo {
  return {
    id: d.id,
    placa: d.placa,
    prestador: d.prestador || '',
    // Disparo não guarda associacao/cnpj separados — vêm do raw via vModelo etc.
    // Por enquanto deixamos vazios; quem quiser ver associação no histórico filtra
    // pela placa/prestador. Phase 2: gravar associacao/cnpj no Disparo direto.
    associacao: '',
    cnpj: '',
    valor: d.valor,
    valorFmt: d.valorFmt,
    telefone: d.destinoReal,
    dataAtendimento: d.dataAtendimento,
    dataFmt: d.dataFmt,
    status: d.ultimoStatus,
  };
}

/** Agregações distintas — usadas pelos KPIs do painel. */
export interface ResumoKPIs {
  total: number;
  valorTotal: number;
  prestadoresDistintos: number;
  associacoesDistintas: number;
  cnpjsDistintos: number;
}

export function calcKPIs(items: ItemResumo[]): ResumoKPIs {
  const prestadores = new Set<string>();
  const associacoes = new Set<string>();
  const cnpjs = new Set<string>();
  let valorTotal = 0;
  for (const i of items) {
    if (i.prestador) prestadores.add(i.prestador);
    if (i.associacao) associacoes.add(i.associacao);
    if (i.cnpj) cnpjs.add(i.cnpj);
    valorTotal += i.valor;
  }
  return {
    total: items.length,
    valorTotal,
    prestadoresDistintos: prestadores.size,
    associacoesDistintas: associacoes.size,
    cnpjsDistintos: cnpjs.size,
  };
}

/** Slice "Por <campo>": agrupa e soma. */
export interface SliceLinha {
  chave: string;        // valor do campo agrupado (nome do prestador, CNPJ, etc.)
  qtd: number;
  somaValor: number;
  somaValorFmt: string;
  /** Em "Por CNPJ", lista de prestadores atrelados àquele CNPJ. */
  prestadoresAtrelados?: string[];
  /** Em "Por Associação", lista de CNPJs sob aquela associação. */
  cnpjsAtrelados?: string[];
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function sliceBy(
  items: ItemResumo[],
  campo: 'prestador' | 'associacao' | 'cnpj' | 'status',
): SliceLinha[] {
  const map = new Map<string, { qtd: number; soma: number; prestadores: Set<string>; cnpjs: Set<string> }>();
  for (const i of items) {
    const chave = (i[campo] || '—').toString();
    const ent = map.get(chave) ?? { qtd: 0, soma: 0, prestadores: new Set(), cnpjs: new Set() };
    ent.qtd++;
    ent.soma += i.valor;
    if (i.prestador) ent.prestadores.add(i.prestador);
    if (i.cnpj) ent.cnpjs.add(i.cnpj);
    map.set(chave, ent);
  }
  const linhas: SliceLinha[] = Array.from(map.entries()).map(([chave, v]) => ({
    chave,
    qtd: v.qtd,
    somaValor: v.soma,
    somaValorFmt: BRL(v.soma),
    ...(campo === 'cnpj'       ? { prestadoresAtrelados: Array.from(v.prestadores).sort() } : {}),
    ...(campo === 'associacao' ? { cnpjsAtrelados:       Array.from(v.cnpjs).sort() }       : {}),
  }));
  linhas.sort((a, b) => b.somaValor - a.somaValor);
  return linhas;
}
