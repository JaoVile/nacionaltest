import { carregarAtendimentos } from '../../lib/atendimentos';
import { loadConfig } from '../../src/config';
import { DisparosClient } from './disparos-client';
import { DisparosHero } from './DisparosHero';
import { ModoManualNotice } from './ModoManualNotice';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TEMPLATE_PREVIEW_LINHAS = [
  'Bom dia, Prezados!',
  '',
  'Solicitamos, por gentileza, o envio da Nota Fiscal referente aos',
  'serviços prestados, com URGÊNCIA E PRIORIDADE ainda hoje, para',
  'que possamos dar continuidade aos procedimentos internos de',
  'conferência e pagamento.',
  '',
  'Associação: {{associação}}',
  'CNPJ: {{cnpj}}',
  'Placa: {{placa}}',
  'Protocolo {{protocolo}}',
  'Modelo: {{modelo}}',
  'Valor: {{valor}}',
  'Data de atendimento: {{data}}',
  '',
  'Ficamos no aguardo e à disposição para qualquer esclarecimento.',
];

export default async function DisparosPage({
  searchParams,
}: {
  searchParams: { dataInicial?: string; dataFinal?: string };
}) {
  const cfg = loadConfig();
  const dados = await carregarAtendimentos({
    dataInicial: searchParams.dataInicial,
    dataFinal:   searchParams.dataFinal,
  });

  return (
    <div className="page-shell">
      <DisparosHero
        mapeaveis={dados.mapeaveis.length}
        ignorados={dados.ignorados.length}
        testMode={cfg.TEST_MODE}
        testPhone={cfg.TEST_PHONE_NUMBER}
      />

      {dados.erro && <ModoManualNotice />}

      <DisparosClient
        mapeaveis={dados.mapeaveis}
        ignorados={dados.ignorados}
        testMode={cfg.TEST_MODE}
        testPhone={cfg.TEST_PHONE_NUMBER}
        templateLinhas={TEMPLATE_PREVIEW_LINHAS}
        dataInicial={searchParams.dataInicial ?? dados.janelaInicio.split('/').reverse().join('-')}
        dataFinal={searchParams.dataFinal ?? new Date().toISOString().slice(0, 10)}
        janelaInicio={dados.janelaInicio}
        janelaFim={dados.janelaFim}
      />
    </div>
  );
}
