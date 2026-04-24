import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { loadConfig } from '../../../../../src/config';
import { requireUser } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ENDPOINTS_DETALHE = (id: string) => [
  `/chat/v1/template/${encodeURIComponent(id)}`,
  `/chat/v1/templates/${encodeURIComponent(id)}`,
  `/chat/v1/message/template/${encodeURIComponent(id)}`,
];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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

  for (const url of ENDPOINTS_DETALHE(params.id)) {
    try {
      const r = await http.get(url);
      tentativas.push({ url, status: r.status, body: r.data });
      if (r.status >= 200 && r.status < 300) {
        return NextResponse.json({ endpoint: url, template: r.data, tentativas });
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
      erro: `Template ${params.id} não encontrado em nenhum endpoint conhecido.`,
      tentativas,
    },
    { status: 404 },
  );
}
