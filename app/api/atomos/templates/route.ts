import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { loadConfig } from '../../../../src/config';
import { requireUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Proxy para a listagem de templates do AtomosChat.
 *
 * A documentação Helena/Atomos não confirma o endpoint exato, então tentamos
 * caminhos comuns em ordem até algum retornar 2xx. Se nenhum funcionar,
 * devolvemos o último erro pra diagnóstico.
 */
const ENDPOINTS_LISTA = [
  '/chat/v1/template',
  '/chat/v1/templates',
  '/chat/v1/message/template',
];

export async function GET(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const cfg = loadConfig();
  if (!cfg.ATOMOS_BEARER_TOKEN) {
    return NextResponse.json(
      { erro: 'ATOMOS_BEARER_TOKEN não configurado' },
      { status: 400 },
    );
  }

  const http = axios.create({
    baseURL: cfg.ATOMOS_BASE_URL,
    timeout: 15_000,
    headers: {
      Authorization: `Bearer ${cfg.ATOMOS_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  });

  const tentativas: Array<{ url: string; status: number; body: unknown }> = [];

  for (const url of ENDPOINTS_LISTA) {
    try {
      const r = await http.get(url);
      tentativas.push({ url, status: r.status, body: r.data });
      if (r.status >= 200 && r.status < 300) {
        return NextResponse.json({ endpoint: url, items: r.data, tentativas });
      }
    } catch (e) {
      const ax = e as AxiosError;
      tentativas.push({
        url,
        status: ax.response?.status ?? 0,
        body: ax.response?.data ?? ax.message,
      });
    }
  }

  return NextResponse.json(
    {
      erro: 'Nenhum endpoint de listagem de templates funcionou.',
      tentativas,
      sugestao: 'A API Atomos pode não expor listagem. Use a busca por ID.',
    },
    { status: 404 },
  );
}
