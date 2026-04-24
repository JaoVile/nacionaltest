import axios, { AxiosInstance } from 'axios';
import { loadConfig } from '../config';
import { logger } from '../logger';
import type {
  AtendimentoDevSul,
  DevSulResumoRequest,
  DevSulResumoResponse,
} from './types';

export async function fetchAtendimentos(
  req: DevSulResumoRequest,
): Promise<AtendimentoDevSul[]> {
  const cfg = loadConfig();
  const http: AxiosInstance = axios.create({
    baseURL: cfg.DEVSUL_API_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${cfg.DEVSUL_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  logger.debug({ req }, 'DevSul: consultando atendimentos');
  const { data } = await http.post<DevSulResumoResponse>('', req);

  const list = normalizeList(data);
  logger.info({ total: list.length }, 'DevSul: atendimentos recebidos');
  return list;
}

function normalizeList(raw: DevSulResumoResponse): AtendimentoDevSul[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const candidate =
      (raw as { value?: unknown }).value ??
      (raw as { data?: unknown }).data ??
      (raw as { atendimentos?: unknown }).atendimentos ??
      (raw as { items?: unknown }).items;
    if (Array.isArray(candidate)) return candidate as AtendimentoDevSul[];
  }
  logger.warn(
    { preview: JSON.stringify(raw).slice(0, 200) },
    'DevSul: formato de resposta inesperado — retornando lista vazia',
  );
  return [];
}
