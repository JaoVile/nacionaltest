# Projeto: Envio de Cobrança de Prestador — Nacional

Módulo que consome a API da **DevSul** para buscar atendimentos/cobranças e dispara mensagens via **ÁtomosChat (Helena API — API Oficial WhatsApp)** na conta da **Nacional**.

---

## 1. Requisitos Funcionais (RF)

| ID | Requisito | Descrição |
|----|-----------|-----------|
| **RF.01** | Consumo da API DevSul | Requisição `POST` para endpoint DevSul filtrando por `DataInicial`, `DataFinal` e `Situacoes`. Bearer Token gerenciado via variável de ambiente. |
| **RF.02** | Mapeamento de Variáveis | Processar JSON de retorno e mapear campos (nome, valor, vencimento, etc.) para variáveis do template ÁtomosChat (Helena). |
| **RF.03** | Modo de Teste Homologado | Disparo isolado para o número de teste definido em `TEST_PHONE_NUMBER` (`.env`) antes da carga completa, para validar layout e variáveis. |
| **RF.04** | Integração ÁtomosChat | Disparar mensagens via API Oficial no endpoint de mensagens de template, conforme documentação Helena. |
| **RF.05** | Controle de Vazão (Rate Limit) | Delay obrigatório de **1 segundo** entre cada disparo. |
| **RF.06** | Agendamento Cron | Disparável via Cron Job, com parametrização de frequência (dias) e horário (HH:mm) via arquivo de configuração ou interface. |
| **RF.07** | Log de Processamento | Registrar cada envio: ID do atendimento, status (Sucesso/Erro) e resposta da API ÁtomosChat. |

---

## 2. Integração DevSul (origem dos dados)

- **Host:** `api.lnsoft.com.br`
- **Recurso:** `/devsul/integracao/atendimentos/resumo` (método `POST`)
- **Autenticação:** Bearer Token via env var `DEVSUL_BEARER_TOKEN`
- **Content-Type:** `application/json`

### Token
- **NÃO** commitar tokens neste repositório, mesmo sendo privado.
- Token deve vir exclusivamente de `.env` (ver `.env.example`).
- Payload JWT do token de referência (metadados, sem o token em si): `iss=Api DevSul`, `id_empresa=82`, `list_empresa="44"`.

### Parâmetros do corpo (contrato)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `DataInicial` | `string` (YYYY-MM-DD) | Início da janela de busca |
| `DataFinal` | `string` (YYYY-MM-DD) | Fim da janela de busca |
| `Situacoes` | *a definir* | Filtro de situações do atendimento (formato pendente) |

---

## 3. Integração ÁtomosChat (destino das mensagens)

- **Host:** `api.chat.atomos.tech`
- **Recurso de envio:** `/chat/v1/message/send` (método `POST`)
- **Conta:** Nacional — usando **API Oficial** do WhatsApp
- **Referência técnica:** ÁtomosChat é o deploy real; a documentação Helena serve apenas de referência de formato.
  - Helena getting started: https://helena.readme.io/reference/getting-started-with-your-api
  - Helena chatbot: https://helena.readme.io/reference/get_v1-chatbot

### Credenciais necessárias (todas via `.env`)

O projeto usa **duas credenciais separadas** no ÁtomosChat, mais o ID do template:

| Env var | O que é | Onde obter |
|---------|---------|------------|
| `ATOMOS_BEARER_TOKEN` | Token permanente de autenticação. Prefixo `pn_`. Vai no header `Authorization: Bearer pn_...`. | Criar em **Nacional → Ajustes → Integrações → Integração via API** |
| `ATOMOS_CHANNEL_ID` | UUID do canal aprovado pela Meta. Identifica o WhatsApp remetente (campo `from` no payload). | Portal Nacional (canal já aprovado) |
| `ATOMOS_TEMPLATE_ID` | ID do template `notafiscal`. Valor conhecido: `9664d_notafiscal`. | Portal Nacional / Templates |

**Importante:** nenhum valor real vai para arquivos commitados. `.env.example` tem só placeholders.

### Template de mensagem — `notafiscal`

- **Categoria:** Utilidade
- **Status:** Ativo
- **Tipo:** Atendimento
- **Disponibilidade:** Toda a empresa
- **Canal vinculado:** (81) 98625-8568
- **Propósito:** lembrar prestador a enviar a Nota Fiscal (é o "cobrança" do projeto).

**Corpo (texto fixo + variáveis nomeadas):**

```
Bom dia, Prezados!

Solicitamos, por gentileza, o envio da Nota Fiscal referente aos
serviços prestados, com URGÊNCIA E PRIORIDADE ainda hoje, para
que possamos dar continuidade aos procedimentos internos de
conferência e pagamento.

Associação: [associação]
CNPJ: [cnpj]
Placa: [placa]
Protocolo [protocolo]
Modelo: [modelo]
Valor: [valor]
Data de atendimento: [data]

Ficamos no aguardo e à disposição para qualquer esclarecimento.
```

**Variáveis (nome enviado no payload Atomos):**

| Nome         | Campo DevSul        | Formato de envio                  | Exemplo                 |
|--------------|---------------------|-----------------------------------|-------------------------|
| `associação` | `Regional`          | string                            | `Nacional Assistência`  |
| `cnpj`       | lookup `Regional` (ver §4) | string                     | `57.220.668/0001-61`    |
| `placa`      | `Placa`             | string                            | `abc1234`               |
| `protocolo`  | `Protocolo`         | string prefixada `NO-`            | `NO-260422075110`       |
| `modelo`     | `Modelo`            | string                            | `Civic`                 |
| `valor`      | `ValorNF`           | `R$ 1.234,56` (pt-BR)             | `R$100,90`              |
| `data`       | `DataHora`          | `DD/MM/YYYY`                      | `20/02/2026`            |

**Observações conhecidas:**
- "Bom dia" está hardcoded no template. Disparos em outros períodos manterão a saudação. Considerar: agendar cron apenas pela manhã **ou** criar templates irmãos por período.
- Template não contém nome do prestador. Se for necessário personalizar, exigirá novo template aprovado.
- CNPJ **não vem** da DevSul — é resolvido via lookup local `Regional → CNPJ` (ver §4). A Meta trata como texto livre dentro da variável do template, então injeção manual é válida.

---

## 4. Mapeamento CNPJ por Regional (fonte de verdade)

Base: análise de `tmp/devsul_sample.json` (192 atendimentos, janela de 1 dia).
Existem **9 valores distintos** de `Regional` — 8 reais + 1 vazio. CNPJ é mantido **manual** aqui porque o volume é baixo e a DevSul não entrega o campo.

| Regional (valor exato vindo da DevSul)          | Atend. (sample) | CNPJ                    |
|-------------------------------------------------|-----------------|-------------------------|
| `MODELO ASSOCIACAO DE PROTECAO VEICULAR`        | 88              | _preencher_             |
| `AUTOCAR BRASIL - 2024`                         | 43              | _preencher_             |
| `L2 PROTEÇÃO AUTOMOTIVA`                        | 17              | _preencher_             |
| `` (string vazia)                               | 12              | — (não dispara)         |
| `CERTEZA - PROTEÇÃO ASSOCIAÇÃO`                 | 9               | _preencher_             |
| `RECORD PROTECAO VEICULAR`                      | 9               | _preencher_             |
| `MODELO APV`                                    | 7               | _preencher_             |
| `BRAVO PROTECAO VEICULAR`                       | 6               | _preencher_             |
| `REGIONAL MIGRAÇÃO`                             | 1               | — (não dispara)         |

**Regras de aplicação (mapper.ts):**
- Comparação de `Regional` é **literal e case-sensitive** (mesma string que vem do JSON).
- Regional `""` ou `REGIONAL MIGRAÇÃO` → atendimento é **ignorado** (loga como `skipped: regional_sem_cnpj`).
- Regional sem entrada na tabela (nova associação aparecer) → **ignora + alerta no log** para não disparar sem CNPJ.
- `MODELO APV` e `MODELO ASSOCIACAO DE PROTECAO VEICULAR` são entradas separadas até confirmação (podem ou não compartilhar CNPJ).

Arquivo de implementação: `src/data/cnpj-por-regional.ts` (objeto literal — a tabela acima é a fonte de verdade).

---

## 5. Pontos em aberto / decisões pendentes

- **RF.01** — formato do campo `Situacoes` no request DevSul (atualmente string única `"1282"`, parece funcionar).
- **RF.06** — formato de config de cron: `.env`/`config.yaml` ou interface web?
- **CNPJ por Regional** — preencher tabela §4. `MODELO APV` vs `MODELO ASSOCIACAO...` — mesma empresa?
- **API de templates Atomos** — proxy tenta 3 paths (`/chat/v1/template`, `/chat/v1/templates`, `/chat/v1/message/template`). Nenhum confirmado ainda; a busca por ID pode cair em 404 até a Atomos expor endpoint.

### Decisões já fechadas

- **Stack:** Next.js 14 + React 18 + TypeScript + Prisma + Tailwind. Runner CLI paralelo (`src/index.ts`).
- **Mapeamento DevSul → template:** ver §3 (7 variáveis, template `notafiscal`, ID `9664d_notafiscal`).
- **CNPJ:** lookup local manual (ver §4), não via DevSul.
- **Auto-conclusão de atendimento ao receber resposta:** nativa do Atomos, não implementar.
- **Log de processamento (RF.07):** gravado na tabela `Disparo` do Prisma — request, response, http status, timeline e raw DevSul (ver §8).
- **Modo de teste homologado (RF.03):** primeiro envio sempre vai pro `TEST_PHONE_NUMBER` quando `TEST_MODE=false`, com gate de 15s antes de liberar os reais (ver §8).
- **Payload Atomos `/chat/v1/message/send`:** `{ to, from, body: { templateId, parameters } }` — validado em produção.
- **Formato do telefone destinatário:** E.164 sem `+` (ex: `5581999430696`) — validado.

---

## 6. Estrutura do repositório

Stack: **Next.js 14 + React 18 + TypeScript + Prisma + Tailwind**. O projeto é um **painel web** (app router) com um runner CLI paralelo para cron.

Dependências runtime principais: `next`, `react`, `@prisma/client`, `axios`, `zod`, `pino`, `node-cron`, `date-fns`, `dotenv`, `lucide-react`, `framer-motion`, `sonner`, `cmdk`, `write-excel-file`. Dev: `tailwindcss`, `typescript`, `tsx`, `prisma`.

```
nacional/
├── package.json
├── tsconfig.json
├── tailwind.config.ts          # paleta, easings, shadows, keyframes (ver §7)
├── postcss.config.mjs
├── next.config.mjs
├── .env.example
├── prisma/
│   └── schema.prisma           # modelo Disparo (histórico)
├── lib/
│   └── db.ts                   # prisma client singleton
├── app/                        # Next app router
│   ├── layout.tsx              # fontes + themeScript + Shell
│   ├── globals.css             # design tokens e componentes (.card, .btn, .nav-link, mesh-hero, cmdk...)
│   ├── page.tsx                # Dashboard (server component) — consome DevSul + Prisma
│   ├── run-button.tsx          # client — executa /api/run com toast + sfx + modais
│   ├── chart-disparos.tsx      # client — chart de 14 dias com barras animadas
│   ├── theme-toggle.tsx        # client — sol/lua crossfade
│   ├── components/
│   │   ├── Shell.tsx           # layout raiz (SfxProvider + CommandPalette + Toaster + PageTransition)
│   │   ├── SideNav.tsx         # navegação desktop + mobile
│   │   ├── TopBar.tsx          # barra mobile
│   │   ├── SfxProvider.tsx     # context de som (default OFF, localStorage)
│   │   ├── SfxToggle.tsx       # botão no TopBar/SideNav
│   │   ├── CommandPalette.tsx  # ⌘K (cmdk + framer-motion)
│   │   ├── Toaster.tsx         # sonner com sync de tema
│   │   ├── PageTransition.tsx  # fade+slide entre rotas
│   │   └── DisparoDetailDrawer.tsx # drawer com log completo de 1 disparo (ver §8)
│   ├── dashboard/              # peças específicas do dashboard
│   │   ├── Hero.tsx            # headline serif + mesh gradient
│   │   ├── StatCard.tsx        # count-up com spring physics
│   │   ├── ActionCard.tsx      # lift + glow no hover
│   │   └── FadeIn.tsx          # wrapper genérico de stagger
│   ├── lib/
│   │   └── sfx.ts              # Web Audio (tons sintéticos, zero assets)
│   ├── disparos/               # tela de revisar/enviar cobranças
│   │   ├── page.tsx
│   │   ├── disparos-client.tsx # AbortController + handler SSE + manuais
│   │   ├── disparo-live.tsx    # painel bottom-right ao vivo (cancelar, log expansível)
│   │   └── TemplatePreview.tsx # preview bottom-left da mensagem em envio (§8)
│   ├── historico/              # tabela + filtros + drawer + export Excel
│   ├── config/                 # edição do .env via UI
│   ├── templates/              # preview + buscar por ID + listar + definir ativo (§8)
│   └── api/
│       ├── run/route.ts                 # POST — dispara execução do runner
│       ├── disparos/route.ts            # POST (fluxo síncrono antigo)
│       ├── disparos/stream/route.ts     # SSE com gate de teste + cancelamento (§8)
│       ├── disparos/[id]/route.ts       # detalhe completo (drawer)
│       ├── historico/route.ts           # listagem
│       ├── historico/refresh/route.ts   # reconsulta status Atomos
│       ├── config/route.ts              # lê/patcha .env
│       ├── atomos/templates/route.ts    # proxy listagem templates (tenta 3 paths)
│       └── atomos/templates/[id]/route.ts # proxy detalhe template por ID
├── src/                        # runner CLI e core compartilhado
│   ├── index.ts                # entrypoint CLI (one-shot ou cron)
│   ├── config.ts               # carrega e valida .env via zod
│   ├── logger.ts               # pino (pretty em dev, JSON em prod)
│   ├── runner.ts               # loop fetch → map → send + delay 1s (RF.05)
│   ├── mapper.ts               # DevSul → parâmetros do template
│   ├── devsul/
│   │   ├── client.ts           # POST atendimentos/resumo (RF.01)
│   │   └── types.ts
│   └── atomos/
│       ├── client.ts           # POST /chat/v1/message/send (RF.04)
│       └── types.ts
├── scripts/
│   └── probe-devsul.ts         # ad-hoc → tmp/devsul_sample.json
└── tmp/
    └── devsul_sample.json      # sample real (192 atendimentos, usado em §4)
```

### Scripts npm

| Comando | O que faz |
|---------|-----------|
| `npm run dev`       | `next dev` — painel web em http://localhost:3000 |
| `npm run build`     | `next build` |
| `npm start`         | `next start` (produção) |
| `npm run cli:dev`   | Runner CLI em modo watch (`tsx src/index.ts`) — usa cron se `CRON_SCHEDULE` existir |
| `npm run cli:run`   | Runner CLI em one-shot (`tsx src/index.ts --once`) |
| `npm run probe`     | `scripts/probe-devsul.ts` — só consulta DevSul e grava `tmp/devsul_sample.json` |
| `npm run typecheck` | `tsc --noEmit` |

### Fluxo de execução (`src/runner.ts`)

1. Calcula janela (`DataInicial = hoje - DEVSUL_LOOKBACK_DAYS`, `DataFinal = hoje`).
2. `fetchAtendimentos()` → lista DevSul.
3. Para cada atendimento:
   - `normalizarAtendimento()` extrai placa, modelo, valor, data, telefone.
   - Se `TEST_MODE=true`, substitui destinatário por `TEST_PHONE_NUMBER` mantendo dados reais.
   - `sendTemplate()` dispara no AtomosChat.
   - Grava resultado no Prisma (tabela `Disparo`) e loga.
   - `await sleep(SEND_DELAY_MS)` — rate limit.
4. Sumário final (total, enviados, falhas, ignorados).

O endpoint `app/api/run/route.ts` invoca esse mesmo runner quando o botão **Executar agora** é clicado no dashboard.

---

## 7. Design system / front-end

### Paleta (via `tailwind.config.ts`)

- **Accent** — azul-claro `#3B82F6` (light) / azul-profundo `accent-deep` `#1D4ED8` (dark)
- **Ivory** 50–500 — marfim quente (`#FBF8EF` → `#A79B78`), usado como texto no dark
- **Deep** 50–400 — deep navy (`#1F2A3F` → `#070D1C`), usado como bg/surface no dark
- **Slate** (Tailwind default) — bg/text no light

**Light mode:** `bg-slate-50` + texto `slate-900` + acento `#3B82F6`
**Dark mode:** `bg-deep-300` + texto `ivory-200` + acento `accent-deep` com `shadow-glow-deep`

### Tipografia

- **Sans:** Inter (`--font-sans`)
- **Mono:** JetBrains Mono (`--font-mono`)
- **Serif:** Instrument Serif (`--font-serif`) — headlines editoriais (Hero do dashboard, títulos de modal)

### Motion / feel

- Easings: `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`), `ease-out-back`, `ease-out-smooth`
- Durações ≤ 300ms nas microinterações, ≤ 500ms em entrada de seção
- `prefers-reduced-motion` corta tudo globalmente (override em `globals.css`)
- Framer Motion para: PageTransition, modais (AnimatePresence), chart (barras em cascata), StatCard (count-up com spring), command palette

### Áudio

- `app/lib/sfx.ts` — Web Audio puro, sem assets. Tons sintéticos: `click`, `open`, `success`, `error`
- **Default OFF**. Toggle em TopBar/SideNav persiste em `localStorage` como `sfx-enabled`.

### Atalhos

- **⌘K / Ctrl+K** — abre CommandPalette (navegação, executar agora, alternar tema)
- **ESC** — fecha modais/palette

### Estado de cada tela

| Tela | Caminho | Status visual | Funcional |
|------|---------|---------------|-----------|
| Dashboard | `/` | **Premium** (Hero serif, StatCards count-up, chart animado, RunButton). ✅ | ✅ |
| Disparos | `/disparos` | Paleta `zinc-*` residual. ⏳ | ✅ (preview+cancelar+gate — §8) |
| Histórico | `/historico` | Idem. ⏳ | ✅ (drawer click-to-see-all — §8) |
| Templates | `/templates` | Idem. ⏳ | ✅ (buscar/listar/definir — §8) |
| Configurações | `/config` | Idem. ⏳ | ✅ |

Shell/TopBar/SideNav/toggles **já estão na paleta nova** — toda tela herda bg + nav corretos; só os conteúdos internos têm `zinc-*` residual.

### Próximos passos do front

1. Propagar paleta nova (`slate` / `ivory` / `deep`) para Disparos, Histórico, Templates, Config.
2. Aplicar padrão de animação (FadeIn, StatCard, AnimatePresence em modais) onde fizer sentido.
3. Adicionar SFX nos handlers de ação nas outras telas.

---

## 8. Arquitetura de disparo (UI + SSE + log completo)

Fluxo via painel `/disparos` (endpoint `app/api/disparos/stream/route.ts`, SSE). O runner CLI (`src/runner.ts`) segue fluxo simplificado sem gate.

### Eventos SSE emitidos (ordem)

| Evento | Quando | Payload-chave |
|--------|--------|---------------|
| `start`       | Início       | `total` |
| `gate-start`  | Abre gate de teste (só se `TEST_MODE=false`) | — |
| `testing`     | Disparo teste em curso | `placa`, `values`, `destinoEfetivo` (= `TEST_PHONE_NUMBER`) |
| `test-result` | Teste concluído | `ok`, `status`, `failureReason`, `request`, `response`, `disparoId` |
| `aborted`     | Teste falhou — nenhum envio real feito | `reason` |
| `countdown`   | Contagem regressiva 15s após teste OK | `remaining`, `total` |
| `gate-passed` | Libera loop real | — |
| `sending`     | Item atual sendo enviado | `current`, `placa`, `values`, `destinoEfetivo` |
| `result`      | Item concluído | `ok`, `status`, `httpStatus`, `elapsedMs`, `atomosMessageId`, `request`, `response`, `statusCheck`, `disparoId` |
| `canceled`    | Usuário cancelou | `reason` |
| `done`        | Tudo ok | `enviadosOk`, `queued`, `falhas` |
| `fatal`       | Erro na validação/auth | `message` |

### Gate de teste prévio (RF.03)

- Ativado automaticamente quando `TEST_MODE=false` e há ao menos 1 destinatário.
- Envia **o primeiro item** com destino forçado para `TEST_PHONE_NUMBER`, `origem='TEST'` na tabela `Disparo`.
- Se teste falhar (`ok=false` ou `status ∈ {FAILED, ERROR}`): emite `aborted` e **não envia pros reais**.
- Se teste OK: emite `countdown` (15s, ticks de 1s) → `gate-passed` → loop real.
- Pode ser pulado com `body.skipGate=true` (não exposto na UI atualmente).

### Cancelamento

- Cliente guarda `AbortController`, passa `signal` ao `fetch` do SSE.
- Servidor observa `req.signal.aborted` em todas as sleeps, entre iterações e dentro do axios (via `signal` em `sendTemplate`/`getMessageStatus`).
- Funciona durante `testing`, `countdown` e `sending`. Emite `canceled` com motivo.

### Log completo (RF.07) — colunas em `Disparo`

Além de `ultimoStatus`, `failureReason`, `errorMessage`, guardamos por disparo:

| Coluna | Conteúdo |
|--------|----------|
| `requestPayload`  | JSON do body enviado ao Atomos |
| `responseBody`    | JSON retornado pelo Atomos (inclusive em erro) |
| `httpStatus`      | Código HTTP da resposta Atomos |
| `statusCheckBody` | JSON do `getMessageStatus` pós-envio (feito ~2s depois) |
| `rawAtendimento`  | JSON do atendimento DevSul original (audit) |
| `elapsedMs`       | Tempo total do request (ms) |
| `origem`          | `UI` \| `AUTO` \| `TEST` |

Nenhum token/header entra em `requestPayload` — só o body. **Migração aplicada:** `20260423135037_add_log_fields`.

### Drawer de detalhe `DisparoDetailDrawer`

- Clique em qualquer linha de `/historico` abre drawer lateral com todas as seções (resumo, atendimento, destino, variáveis, erros, timeline, payload, resposta Atomos, status check, raw DevSul, audit logs correlacionados).
- Mesmo drawer é reutilizado pelo `DisparoLive` (botão "log completo" em cada resultado durante o envio).
- Endpoint: `GET /api/disparos/[id]` — retorna `disparo` + `eventos` + `auditLogs` (janela ±5min por match de `id`/`atendimentoId` na `metadata`).

### Preview do template durante envio — `TemplatePreview.tsx`

- Painel bottom-left (contraparte do `DisparoLive` bottom-right) com a mensagem completa e **variáveis substituídas pelo item atual**.
- Renderizada como bolha WhatsApp. Atualiza a cada `sending`/`testing` do SSE.
- Linhas do template vêm de `TEMPLATE_PREVIEW_LINHAS` em `app/disparos/page.tsx`.

### Gestão de templates — `/templates`

- Input de ID + botão **Carregar** (`GET /api/atomos/templates/:id`) — mostra JSON da resposta Atomos.
- Botão **Definir como ativo** — `PATCH /api/config` com `ATOMOS_TEMPLATE_ID`, regrava `.env` e atualiza `process.env` em runtime (sem restart).
- Botão **Listar todos** (`GET /api/atomos/templates`) — tenta 3 paths; mostra todas as tentativas no JSON de resposta se nenhum der 2xx.
- **Proxies tentam 3 paths em ordem**: `/chat/v1/template`, `/chat/v1/templates`, `/chat/v1/message/template`. Primeiro 2xx ganha; senão 404 com diagnóstico.

---

## Fontes

- PDF original: `api_cobranca.pdf` (no raiz do repo, referência local).
- Documentação Helena — getting started: https://helena.readme.io/reference/getting-started-with-your-api
- Documentação Helena — chatbot: https://helena.readme.io/reference/get_v1-chatbot
