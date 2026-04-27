import { format } from 'date-fns';
import type { AtendimentoDevSul } from './devsul/types';
import type { TemplateValues } from './atomos/types';
import { formatCnpj } from './devsul/regionais';

/**
 * Mapeia um atendimento da DevSul para as 7 variáveis do template `notafiscal`:
 *
 *   1 = associação  |  2 = cnpj       |  3 = placa  |  4 = protocolo
 *   5 = modelo      |  6 = valor      |  7 = data de atendimento
 *
 * Campo `cnpj` não aparece no sample DevSul atual — mantido como pendente
 * (string vazia até decidirmos a origem).
 */

const PATHS = {
  id:         ['Id', 'id', 'ID'],
  placa:      ['Placa', 'placa'],
  modelo:     ['Modelo', 'modelo'],
  valor:      ['ValorNF', 'Valor', 'valor', 'valorTotal'],
  data:       ['DataHora', 'dataAtendimento', 'DataAtendimento', 'data', 'Data'],
  telefone:   ['FornecedorTelefones', 'Telefone', 'telefone', 'Celular', 'celular'],
  prestador:  ['Fornecedor', 'Prestador', 'prestador', 'NomePrestador'],
  associacao: ['Regional', 'Associacao', 'associacao', 'Cooperativa'],
  cnpj:       ['DocumentoCliente', 'CNPJ', 'Cnpj', 'cnpj', 'FornecedorCNPJ', 'CnpjFornecedor'],
  protocolo:  ['Protocolo', 'protocolo'],
} as const;

export interface AtendimentoNormalizado {
  id: string;
  placa: string;
  modelo: string;
  valor: number;
  dataAtendimento: Date;
  telefone: string;
  prestador?: string;
  associacao: string;
  cnpj: string;
  protocolo: string;
  raw: AtendimentoDevSul;
}

export function normalizarAtendimento(item: AtendimentoDevSul): AtendimentoNormalizado | null {
  const id        = asString(pickFirst(item, PATHS.id));
  const placa     = asString(pickFirst(item, PATHS.placa));
  const modelo    = asString(pickFirst(item, PATHS.modelo));
  const valorRaw  = pickFirst(item, PATHS.valor);
  const dataRaw   = pickFirst(item, PATHS.data);
  const telefone  = sanitizePhone(asString(pickFirst(item, PATHS.telefone)));
  const prestador = asString(pickFirst(item, PATHS.prestador));
  const associacao = asString(pickFirst(item, PATHS.associacao));
  const cnpjRaw    = asString(pickFirst(item, PATHS.cnpj));
  const cnpj       = cnpjRaw ? formatCnpj(cnpjRaw) : '';
  const protocolo  = asString(pickFirst(item, PATHS.protocolo));

  const valor = toNumber(valorRaw);
  const dataAtendimento = toDate(dataRaw);

  if (!placa || !modelo || valor == null || !dataAtendimento || !telefone) {
    return null;
  }

  return {
    id: id || placa,
    placa,
    modelo,
    valor,
    dataAtendimento,
    telefone,
    prestador: prestador || undefined,
    associacao,
    cnpj,
    protocolo,
    raw: item,
  };
}

export interface AtendimentoParcial {
  id: string;
  placa: string;
  modelo: string;
  valor: number | null;
  dataAtendimento: Date | null;
  prestador: string;
  associacao: string;
  cnpj: string;
  protocolo: string;
}

export function normalizarParcial(item: AtendimentoDevSul): AtendimentoParcial {
  const id        = asString(pickFirst(item, PATHS.id));
  const placa     = asString(pickFirst(item, PATHS.placa));
  const modelo    = asString(pickFirst(item, PATHS.modelo));
  const valorRaw  = pickFirst(item, PATHS.valor);
  const dataRaw   = pickFirst(item, PATHS.data);
  const prestador = asString(pickFirst(item, PATHS.prestador));
  const associacao = asString(pickFirst(item, PATHS.associacao));
  const cnpjRaw    = asString(pickFirst(item, PATHS.cnpj));
  const cnpj       = cnpjRaw ? formatCnpj(cnpjRaw) : '';
  const protocolo  = asString(pickFirst(item, PATHS.protocolo));
  return {
    id: id || placa,
    placa,
    modelo,
    valor: toNumber(valorRaw),
    dataAtendimento: toDate(dataRaw),
    prestador,
    associacao,
    cnpj,
    protocolo,
  };
}

export function toTemplateValues(a: AtendimentoNormalizado): TemplateValues {
  return {
    associacao: a.associacao,
    cnpj:       a.cnpj,
    placa:      a.placa,
    protocolo:  a.protocolo ? `NO-${a.protocolo}` : '',
    modelo:     a.modelo,
    valor:      formatBRL(a.valor),
    data:       format(a.dataAtendimento, 'dd/MM/yyyy'),
  };
}

function pickFirst(obj: unknown, paths: readonly string[]): unknown {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function asString(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function sanitizePhone(raw: string): string {
  if (!raw) return '';
  // Pega o primeiro número quando o campo tem múltiplos (separados por , ; /)
  const first = raw.split(/[,;/]/)[0] ?? '';
  const digits = first.replace(/\D/g, '');
  // Já com DDI 55 (12-13 dígitos)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }
  // DDD + número nacional: 10-11 dígitos → prefixa DDI 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  // 12-13 dígitos sem DDI 55 → trata como nacional com DDD (pega últimos 11)
  if (digits.length === 12 || digits.length === 13) return `55${digits.slice(-11)}`;
  return ''; // formato desconhecido → inválido, será ignorado
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
