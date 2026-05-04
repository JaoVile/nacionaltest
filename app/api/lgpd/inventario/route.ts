/**
 * LGPD art. 9º (informação ao titular) + art. 18 (acesso).
 *
 * GET /api/lgpd/inventario — devolve a estrutura estática de tratamento
 * de dados pessoais que esta aplicação faz. Atualizar manualmente quando
 * o pipeline mudar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INVENTARIO = {
  controlador: {
    nome: 'Nacional Assistência',
    contato: 'your@email.com',
  },
  encarregado: {
    nome: 'A definir',
    contato: 'your@email.com',
  },
  finalidade:
    'Cobrança de Nota Fiscal a prestadores de serviço via WhatsApp, com base em atendimentos cadastrados no sistema DevSul.',
  baseLegal: 'Execução de contrato (art. 7º, V, LGPD) entre Nacional e prestador.',
  dadosPessoaisTratados: [
    {
      campo: 'telefone do prestador',
      origem: 'DevSul',
      finalidade: 'destinatário da mensagem WhatsApp',
      armazenamento: 'mascarado em logs (••••<últimos4>); hash em payloads salvos',
      retencaoDias: 180,
    },
    {
      campo: 'nome do prestador',
      origem: 'DevSul',
      finalidade: 'identificação no histórico interno',
      armazenamento: 'em claro na coluna `Disparo.prestador`',
      retencaoDias: 180,
    },
    {
      campo: 'placa do veículo',
      origem: 'DevSul',
      finalidade: 'parâmetro do template (rastreio do atendimento)',
      armazenamento: 'em claro na coluna `Disparo.placa`',
      retencaoDias: 180,
    },
    {
      campo: 'CNPJ',
      origem: 'lookup local (DevSul regionais)',
      finalidade: 'parâmetro do template',
      armazenamento: 'em claro',
      retencaoDias: 180,
    },
    {
      campo: 'IP do operador',
      origem: 'request HTTP',
      finalidade: 'auditoria de ações',
      armazenamento: 'mascarado (últimos 2 octetos zerados) na tabela AuditLog',
      retencaoDias: 365,
    },
  ],
  compartilhamento: [
    {
      destinatario: 'DevSul (api.lnsoft.com.br)',
      proposito: 'consulta de atendimentos / regionais (entrada de dados)',
      paisHospedagem: 'Brasil',
    },
    {
      destinatario: 'Atomos / Helena (api.chat.atomos.tech)',
      proposito: 'envio de mensagens template via API oficial WhatsApp (saída)',
      paisHospedagem: 'Brasil',
    },
  ],
  direitosTitular: [
    'Acesso (art. 18, II): GET /api/lgpd/acesso?tel=<telefone>',
    'Anonimização (art. 18, IV): POST /api/lgpd/anonimizar { tel: "..." }',
    'Eliminação (art. 18, VI): solicitar contato; aplicação automática via retenção (180 dias)',
  ],
  retencao: {
    Disparo: 180,
    StatusEvento: 180,
    AuditLog: 365,
  },
  segurancaTecnica: [
    'Mascaramento de PII em logs (pino redact)',
    'Mascaramento de IP em auditoria',
    'Tokens de API armazenados apenas em .env (nunca em logs/DB)',
    'TLS obrigatório (HSTS via next.config.mjs)',
    'Cabeçalhos de segurança: CSP, X-Frame-Options DENY, Referrer-Policy strict-origin',
    'Rate-limit por usuário em endpoints sensíveis',
    'Auditoria SHA-256 do payload (não o payload em claro)',
  ],
  ultimaAtualizacao: '2026-04-30',
};

export async function GET(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;

  const rl = checkRateLimit(authed.email, '/api/lgpd');
  if (!rl.ok) return rl.response!;

  return NextResponse.json(INVENTARIO);
}
