# Projeto: Envio de Cobrança de Prestador — Nacional

Módulo que consome a API da **DevSul** para buscar atendimentos/cobranças e dispara mensagens via **ÁtomosChat (Helena API — API Oficial WhatsApp)** na conta da **Nacional**.

---

## 1. Requisitos Funcionais (RF)

| ID | Requisito | Descrição |
|----|-----------|-----------|
| **RF.01** | Consumo da API DevSul | Requisição `POST` para endpoint DevSul filtrando por `DataInicial`, `DataFinal` e `Situacoes`. Bearer Token gerenciado via variável de ambiente. |
| **RF.02** | Mapeamento de Variáveis | Processar JSON de retorno e mapear campos (nome, valor, vencimento, etc.) para variáveis do template ÁtomosChat (Helena). |
| **RF.03** | Modo de Teste Homologado | Disparo isolado para o número **5581992387425** antes da carga completa, para validar layout e variáveis. |
| **RF.04** | Integração ÁtomosChat | Disparar mensagens via API Oficial no endpoint de mensagens de template, conforme documentação Helena. |
| **RF.05** | Controle de Vazão (Rate Limit) | Delay obrigatório de **1 segundo** entre cada disparo. |
| **RF.06** | Agendamento Cron | Disparável via Cron Job, com parametrização de frequência (dias) e horário (HH:mm) via arquivo de configuração ou interface. |
| **RF.07** | Log de Processamento | Registrar cada envio: ID do atendimento, status (Sucesso/Erro) e resposta da API ÁtomosChat. |

---

## 2. Integração DevSul (origem dos dados)

- **Endpoint:** `POST https://api.lnsoft.com.br/devsul/integracao/atendimentos/resumo`
- **Auth:** `Authorization: Bearer <TOKEN>` (via env var — **não commitar**)
- **Content-Type:** `application/json`

### Token
- **NÃO** commitar tokens neste repositório, mesmo sendo privado.
- Token deve vir de variável de ambiente `DEVSUL_BEARER_TOKEN` (ver `.env.example`).
- Payload JWT do token de referência (sem o token em si): `iss=Api DevSul`, `id_empresa=82`, `list_empresa="44"`.

### Body de exemplo
```json
{
  "DataInicial": "2026-01-01",
  "DataFinal":   "2026-01-10",
  "Situacoes":   "1282"
}
```

### cURL de referência
```bash
curl --location 'https://api.lnsoft.com.br/devsul/integracao/atendimentos/resumo' \
  --header "authorization: Bearer $DEVSUL_BEARER_TOKEN" \
  --header 'content-type: application/json' \
  --data '{
    "DataInicial": "2026-01-01",
    "DataFinal":   "2026-01-10",
    "Situacoes":   "1282"
  }'
```

---

## 3. Integração ÁtomosChat / Helena API (destino das mensagens)

- **Base URL:** `http://api.chat.atomos.tech`
- **Endpoint de envio:** `POST /chat/v1/message/send`
- **Documentação oficial:** https://helena.readme.io/reference/getting-started-with-your-api
- **Conta:** Nacional — usando **API Oficial** do WhatsApp

### Itens a validar antes do go-live
1. **Token da Nacional** (Bearer / API Key da conta)
2. **ID do contato** utilizado para as requisições
3. **ID do template** a ser disparado

---

## 4. Pontos em aberto / decisões pendentes

- **RF.01** — formato do campo `Situacoes`: string única, CSV ou array?
- **RF.02** — mapeamento explícito campo DevSul → variável `{{n}}` do template Helena (precisa tabela definitiva).
- **RF.03** — número de teste deve vir de config (não hardcoded).
- **RF.06** — decidir: arquivo `.env`/`config.yaml` **ou** interface web? (impacta escopo).
- **RF.07** — destino do log: arquivo, banco ou stdout/observability? Formato (JSON estruturado?).
- **Stack** — linguagem/runtime ainda não definido (Node? Python? outra?).

---

## 5. Estrutura do repositório

*(a ser definida conforme a stack escolhida)*

---

## Fontes

- PDF original: `api_cobranca.pdf` (no raiz do repo, referência local).
- Documentação Helena: https://helena.readme.io/reference/getting-started-with-your-api
