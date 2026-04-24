export const GLOSSARIO = {
  situacao:
    'Filtro que dizemos à DevSul para buscar só os atendimentos no estado desejado (ex.: concluído e pronto para cobrar nota).',
  queued:
    'A mensagem foi aceita pelo WhatsApp e está na fila para ser entregue. Costuma virar entregue em alguns segundos ou minutos.',
  janela:
    'Intervalo de dias para trás que consultamos na DevSul a cada execução.',
  atendimento:
    'Um serviço prestado por um associado, com placa, valor e data. É a origem da cobrança.',
  disparo:
    'Uma tentativa de envio da mensagem de cobrança pelo WhatsApp.',
  testMode:
    'Quando ligado, todas as mensagens vão para o número de teste — nenhum prestador real recebe.',
  producao:
    'O envio é feito de verdade para os prestadores. Antes do primeiro real, mandamos um teste para validar o template.',
  prontosCobrar:
    'Atendimentos em que encontramos telefone e associação mapeada — estão prontos para receber a mensagem.',
  valorTotal:
    'Soma dos valores dos atendimentos prontos para cobrar. Referência do quanto está sendo cobrado.',
  naoPodeCobrar:
    'Atendimentos sem telefone ou sem associação conhecida. Eles ficam de fora até o cadastro ser corrigido.',
  taxaSucesso:
    'Porcentagem de mensagens entregues no WhatsApp nos últimos 14 dias.',
  entregues:
    'O WhatsApp confirmou a entrega no aparelho do prestador.',
  naoEntregues:
    'O WhatsApp rejeitou ou não conseguiu entregar. Costuma ser número inexistente, bloqueio ou template fora do ar.',
  aguardando:
    'A mensagem foi aceita pelo WhatsApp e está na fila. Costuma virar entregue em segundos ou minutos.',
  teste15s:
    'Antes de disparar para todos, enviamos uma mensagem só para o número de teste. Se der certo, esperamos 15 segundos e seguimos com os reais — tempo pra conferir o resultado.',
  destinoEfetivo:
    'O número que de fato vai receber a mensagem. Em modo de teste é sempre o número de teste configurado.',
  idAtendimento:
    'Código interno da DevSul que identifica este atendimento. Útil para buscar no sistema deles.',
  adicionarTelefone:
    'Quando a DevSul não trouxe o telefone do prestador, você pode digitar manualmente aqui e incluir esse atendimento no disparo.',
  mostrarIgnorados:
    'Mostra os atendimentos que foram descartados por falta de dados (sem telefone ou sem associação). Assim você pode cadastrar o telefone manualmente e incluir no envio.',
} as const;

export type GlossarioKey = keyof typeof GLOSSARIO;

const STATUS_ATOMOS_HUMANO: Record<string, { label: string; tone: 'ok' | 'wait' | 'fail' }> = {
  SENT:      { label: 'Enviada',        tone: 'ok'   },
  DELIVERED: { label: 'Entregue',       tone: 'ok'   },
  READ:      { label: 'Lida',           tone: 'ok'   },
  PENDING:   { label: 'Aguardando',     tone: 'wait' },
  QUEUED:    { label: 'Na fila',        tone: 'wait' },
  PROCESSING:{ label: 'Processando',    tone: 'wait' },
  FAILED:    { label: 'Não entregue',   tone: 'fail' },
  ERROR:     { label: 'Erro',           tone: 'fail' },
  REJECTED:  { label: 'Rejeitada',      tone: 'fail' },
};

export function statusAtomosHumano(status: string | null | undefined) {
  if (!status) return { label: '—', tone: 'wait' as const };
  const up = status.toUpperCase();
  return STATUS_ATOMOS_HUMANO[up] ?? { label: status, tone: 'wait' as const };
}
