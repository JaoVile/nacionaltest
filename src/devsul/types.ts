/**
 * Tipos da resposta da DevSul.
 *
 * ATENÇÃO: estrutura tentativa. Os nomes reais dos campos serão confirmados
 * quando tivermos uma resposta real gravada em `tmp/devsul_sample.json`.
 * O mapper usa `pickFirst` para tolerar variações enquanto o schema não está travado.
 */
export interface AtendimentoDevSul {
  [key: string]: unknown;
}

export interface DevSulResumoRequest {
  DataInicial: string; // YYYY-MM-DD
  DataFinal: string;   // YYYY-MM-DD
  Situacoes: string;
}

export type DevSulResumoResponse = AtendimentoDevSul[] | {
  [key: string]: unknown;
  value?: AtendimentoDevSul[];      // formato observado (OData/.NET style)
  data?: AtendimentoDevSul[];
  atendimentos?: AtendimentoDevSul[];
  items?: AtendimentoDevSul[];
};
