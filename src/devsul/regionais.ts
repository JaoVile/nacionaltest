import axios from 'axios';
import { loadConfig } from '../config';
import { logger } from '../logger';

export interface Regional {
  Id: number;
  Nome: string;
  DocumentoCliente: string;
}

interface RegionaisResponse {
  value?: Regional[];
}

const TTL_MS = 10 * 60 * 1000;
let cache: { map: Map<string, string>; ts: number } | null = null;

function regionaisUrl(): string {
  const cfg = loadConfig();
  return cfg.DEVSUL_API_URL.replace(/\/atendimentos\/resumo\/?$/, '/atendimentos/regionais');
}

export function formatCnpj(digits: string): string {
  const d = (digits ?? '').replace(/\D/g, '');
  if (d.length !== 14) return digits ?? '';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export async function fetchRegionais(): Promise<Regional[]> {
  const cfg = loadConfig();
  const url = regionaisUrl();
  const { data } = await axios.get<RegionaisResponse | Regional[]>(url, {
    timeout: 30_000,
    headers: { Authorization: `Bearer ${cfg.DEVSUL_BEARER_TOKEN}` },
  });
  const list = Array.isArray(data) ? data : (data?.value ?? []);
  return list;
}

export function clearRegionaisCache(): void {
  cache = null;
}

export async function getCnpjPorRegional(opts?: { force?: boolean }): Promise<Map<string, string>> {
  if (!opts?.force && cache && Date.now() - cache.ts < TTL_MS) return cache.map;
  try {
    const list = await fetchRegionais();
    const map = new Map<string, string>();
    for (const r of list) {
      if (r?.Nome && r?.DocumentoCliente) map.set(r.Nome, formatCnpj(r.DocumentoCliente));
    }
    cache = { map, ts: Date.now() };
    logger.info({ total: map.size }, 'Regionais: lookup CNPJ atualizado');
    return map;
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'Regionais: falha ao carregar lookup; usando cache antigo se houver');
    if (cache) return cache.map;
    return new Map();
  }
}

export async function lookupCnpj(nomeRegional: string): Promise<string> {
  if (!nomeRegional) return '';
  const map = await getCnpjPorRegional();
  return map.get(nomeRegional) ?? '';
}
