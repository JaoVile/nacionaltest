/**
 * Payload para POST /chat/v1/message/send.
 *
 * Histórico de hipóteses testadas:
 *   H1 (Meta Cloud API em body.template.components): API aceitou (200 QUEUED)
 *       mas falhou com "Conteúdo da mensagem não pode ser vazio".
 *   H2 (flat: body.templateId + body.parameters nomeados): em teste.
 */
export interface SendMessageRequest {
  to: string;
  from?: string;
  body: MessageBodyTemplate;
  botId?: string;
  senderId?: string;
}

export interface MessageBodyTemplate {
  templateId: string;
  parameters: Record<string, string>;
}

/** Valores mapeados das 7 variáveis do template notafiscal (nomeadas). */
export interface TemplateValues {
  associacao: string;
  cnpj: string;
  placa: string;
  protocolo: string;
  modelo: string;
  valor: string;
  data: string;
}

export interface SendMessageResponse {
  [key: string]: unknown;
}

export interface MessageStatusResponse {
  id: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | string;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
