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
- **Recursos usados:**
  - `POST /devsul/integracao/atendimentos/resumo` — lista de atendimentos (RF.01)
  - `GET  /devsul/integracao/atendimentos/regionais` — lookup `Regional → CNPJ` (ver §4)
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
| `ATOMOS_TEMPLATE_ID` | ID do template `notafiscal`. Valor conhecido: `6b5df_notafiscal`. | Portal Nacional / Templates |

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

## 4. Mapeamento CNPJ por Regional (via API DevSul)

**Fonte:** `GET /devsul/integracao/atendimentos/regionais` retorna a lista oficial:

```json
{ "value": [ { "Id": 680, "Nome": "MODELO ASSOCIACAO DE PROTECAO VEICULAR", "DocumentoCliente": "47163807000109" }, ... ] }
```

Confirmação do probe (2026-04-27, `tmp/devsul_regionais.json`) — 9 regionais, todos com CNPJ:

| `Nome` (match exato com `Regional` do atendimento) | CNPJ                  |
|----------------------------------------------------|-----------------------|
| `MODELO ASSOCIACAO DE PROTECAO VEICULAR`           | 47.163.807/0001-09    |
| `MODELO APV`                                       | 47.163.807/0001-09    |
| `REGIONAL MIGRAÇÃO`                                | 51.850.920/0001-30    |
| `AUTOCAR BRASIL - 2024`                            | 51.850.920/0001-30    |
| `L2 PROTEÇÃO AUTOMOTIVA`                           | 51.959.329/0001-15    |
| `RECORD PROTECAO VEICULAR`                         | 51.197.728/0001-96    |
| `WR ASSOCIADOS`                                    | 27.732.214/0001-09    |
| `CERTEZA - PROTEÇÃO ASSOCIAÇÃO`                    | 40.665.810/0001-81    |
| `BRAVO PROTECAO VEICULAR`                          | 53.920.004/0001-54    |

**Implementação (`src/devsul/regionais.ts`):**
- `getCnpjPorRegional()` — busca a lista, devolve `Map<Nome, CNPJ formatado>`. Cache em memória com TTL de 10 min; fallback pro cache antigo se a API falhar.
- `formatCnpj(digits)` — formata `47163807000109` → `47.163.807/0001-09`.
- Match é **literal e case-sensitive** com o campo `Regional` do atendimento.
- Sem match → `cnpj` vazio (ainda dispara; UI/log mostra). Atualmente não bloqueia envio.

**Pontos resolvidos pela API:**
- `MODELO APV` e `MODELO ASSOCIACAO...` **compartilham CNPJ** (`47.163.807/0001-09`).
- `REGIONAL MIGRAÇÃO` **tem CNPJ** — não precisa mais ser ignorada.
- Regional `""` (string vazia) continua sem como ser resolvido — segue ignorado.

**Wiring:**
- `lib/atendimentos.ts::carregarAtendimentos` pré-carrega o map antes do loop e injeta em cada `AtendimentoView`.
- `src/runner.ts::runOnce` faz o mesmo antes do loop de envios.
- Probe ad-hoc: `npm run probe:regionais` → grava `tmp/devsul_regionais.json`.

---

## 5. Pontos em aberto / decisões pendentes

- **RF.01** — formato do campo `Situacoes` no request DevSul (atualmente string única `"1282"`, parece funcionar).
- **RF.06** — formato de config de cron: `.env`/`config.yaml` ou interface web?
- **API de templates Atomos** — proxy tenta 3 paths (`/chat/v1/template`, `/chat/v1/templates`, `/chat/v1/message/template`). Nenhum confirmado ainda; a busca por ID pode cair em 404 até a Atomos expor endpoint.

### Decisões já fechadas

- **Stack:** Next.js 14 + React 18 + TypeScript + Prisma + Tailwind. Runner CLI paralelo (`src/index.ts`).
- **Mapeamento DevSul → template:** ver §3 (7 variáveis, template `notafiscal`, ID `6b5df_notafiscal`).
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
│   ├── agendamento/            # configuração do scheduler embedded (§9)
│   └── api/
│       ├── run/route.ts                 # POST — dispara execução do runner
│       ├── run/status/route.ts          # GET — estado do run em curso (RunStatePill)
│       ├── disparos/route.ts            # POST (fluxo síncrono antigo)
│       ├── disparos/stream/route.ts     # SSE com gate de teste + cancelamento (§8)
│       ├── disparos/[id]/route.ts       # detalhe completo (drawer)
│       ├── historico/route.ts           # listagem
│       ├── historico/refresh/route.ts   # reconsulta status Atomos
│       ├── config/route.ts              # lê/patcha .env
│       ├── agendamento/route.ts         # GET/PATCH config do scheduler (§9)
│       ├── agendamento/run-now/route.ts # POST dispara rodada agora (§9)
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
│   │   ├── regionais.ts        # GET atendimentos/regionais → lookup CNPJ (§4)
│   │   └── types.ts
│   └── atomos/
│       ├── client.ts           # POST /chat/v1/message/send (RF.04)
│       └── types.ts
├── scripts/
│   ├── probe-devsul.ts         # ad-hoc → tmp/devsul_sample.json
│   └── probe-regionais.ts      # ad-hoc → tmp/devsul_regionais.json (lookup CNPJ)
└── tmp/
    ├── devsul_sample.json      # sample real (192 atendimentos)
    └── devsul_regionais.json   # lookup Regional→CNPJ confirmado
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
| `npm run probe:regionais` | `scripts/probe-regionais.ts` — lista regionais (CNPJ) → `tmp/devsul_regionais.json` |
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

Princípio: **light vivo, dark caridoso.** Light tem branco com subtom azul claro e acentos saturados pra dar vida. Dark mantém deep navy mas suaviza texto, borders e glows — pensado pra trabalho noturno (não brilhar/cansar a vista).

| Token | Light | Dark | Notas |
|-------|-------|------|-------|
| `accent.DEFAULT` | `#2563EB` blue-600 | (não usado direto) | Vivo no light — botões primários, foco, ativo do nav |
| `accent.soft` | `#3B82F6` blue-500 | — | Hover do botão primário no light |
| `accent.glow` | `#60A5FA` blue-400 | — | Glow base |
| `accent.deep` | — | `#3B5BDB` | Suavizado (era `#1D4ED8`) — botão primário no dark |
| `accent.deepSoft` | — | `#5571E5` | Hover do botão no dark |
| `mist.50/100/200` | `#F7FAFE` / `#EEF4FB` / `#DCE8F6` | — | Subtom azul claro: bg de inputs, hovers, cards (border) |
| `ivory.200` | — | `#EDE4D3` | Headlines no dark (era `ivory-100`) |
| `ivory.300` | — | `#E0D3B4` | Body text no dark (era `ivory-200`) — menos glare |
| `ivory.500` | — | `#A79B78` | Eyebrow / muted |
| `deep.100` | — | `#17203A` | Surface (cards) |
| `deep.300` | — | `#0C1427` | Bg do body |

**Light mode:** `bg-white` + gradient sutil azul radial fixo no body (`body::before`) + texto `slate-900` + acento `#2563EB`
**Dark mode:** `bg-deep-300` + texto `ivory-300` (body) / `ivory-200` (headlines) + acento `accent-deep` (`#3B5BDB`) com `shadow-glow-deep` opacidade reduzida

Glows:
- `shadow-glow-accent` (light, vivo): `rgba(37,99,235, .40/.50)`
- `shadow-glow-deep` (dark, caridoso): `rgba(59,91,219, .28/.38)`

### Tipografia

- **Sans:** Inter (`--font-sans`)
- **Mono:** JetBrains Mono (`--font-mono`)
- **Display/Serif:** **Fraunces** (`--font-display`) — eixo `opsz` ativo (optical size). Tailwind aliasa `font-display` e `font-serif` pra mesma var, então as duas classes funcionam.

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

### Auto-refresh passivo (3 min)

Componente `app/components/AutoRefresh.tsx` faz `router.refresh()` em intervalo (default 180_000 ms) com `startTransition` — re-renderiza Server Components sem mudar URL nem desmontar Client Components. **Imperceptível**: estado local (filtros, busca, drawer aberto) preserva.

Salvaguardas:
- Pula tick quando `document.visibilityState !== 'visible'` (não consome com aba oculta).
- Catch-up automático no `visibilitychange` se o intervalo passou.
- Pula tick quando o foco está num input/textarea/select/contentEditable (não atrapalha digitação).

**Wired em:** `app/page.tsx` (Dashboard) e `app/historico/page.tsx`. Disparos não usa porque já tem SSE em tempo real; Templates/Config não precisam.

### Responsividade fluida

- **Headlines** — `clamp()` em `text-display`, `text-h-page` (escala com viewport).
- **Cards** — padding `p-4 sm:p-5 lg:p-6` (mobile compacto, desktop confortável).
- **Modais** — drawer side-right escala `w-full` → `sm:max-w-md` → `md:max-w-xl`. Header e body modais com `px-4 sm:px-6 py-3 sm:py-4`. Centered modal com título `text-xl sm:text-2xl`.
- **Stat grid** — `gap-3 sm:gap-4` (mobile compacto).
- **Shell** — `<main>` já usa `p-4 sm:p-6 md:p-8`.

### Estado de cada tela

| Tela | Caminho | Status visual | Funcional |
|------|---------|---------------|-----------|
| Dashboard | `/` | **Premium** (Hero serif, StatCards count-up, chart animado, RunButton). ✅ | ✅ |
| Disparos | `/disparos` | Paleta `zinc-*` residual. ⏳ | ✅ (preview+cancelar+gate — §8; ResumoPainel — §10) |
| Agendamento | `/agendamento` | Nova paleta + animações. ✅ | ✅ (scheduler embedded — §9; ResumoPainel — §10) |
| Histórico | `/historico` | Idem. ⏳ | ✅ (drawer click-to-see-all — §8; ResumoPainel — §10) |
| Templates | `/templates` | Idem. ⏳ | ✅ (buscar/listar/definir — §8) |
| Configurações | `/config` | Idem. ⏳ | ✅ |

Shell/TopBar/SideNav/toggles **já estão na paleta nova** (light branco + subtom azul mist + accent vivo; dark suavizado) — toda tela herda bg + nav corretos; só os conteúdos internos têm `zinc-*` residual.

### Próximos passos do front

1. Propagar paleta nova (`slate` / `mist` / `ivory` / `deep` / `accent`) para Disparos, Histórico, Templates, Config — substituir `zinc-*` residual.
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

## 9. Scheduler embedded (`/agendamento` + cron in-process)

Resolve **RF.06**. UI + scheduler vivem dentro do processo Next.js — usuário não precisa mais rodar `npm run cli:dev` em terminal paralelo.

### Modelo Prisma `Agendamento` (singleton)

Linha única `id='default'`. Campos:

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| `ativo` | bool | false | Liga/desliga o cron |
| `modo` | string | `'massa'` | `'massa'` (tudo do período) ou `'selecionados'` |
| `diasSemana` | string CSV | `'1,2,3,4,5'` | dias da semana padrão cron (0=dom..6=sab) |
| `hora` | int | 9 | 0-23 |
| `minuto` | int | 0 | 0-59 |
| `placas` | string? | null | JSON array de `atendimentoId` quando `modo='selecionados'` |
| `ultimaExec` | DateTime? | — | preenchido após cada rodada |
| `ultimoTotal/Ok/Falha` | int? | — | resumo da última rodada |
| `ultimoErro` | string? | — | mensagem de erro fatal, se houve |

Migração: `20260427125843_add_agendamento`.

### `lib/scheduler.ts` (singleton via globalThis)

- `aplicarAgendamento()` — lê DB, monta `cronExpr` (`{minuto} {hora} * * {dias}`), valida com `node-cron.validate`, registra. Idempotente: se já está registrado com a mesma expressão, não duplica. Sobrevive ao HMR via `globalThis.__nacionalScheduler`.
- `desligar()` — para e destrói o task (cleanup).
- `montarCronExpr(dias, hora, minuto)` — usado também na UI pra preview.
- `proximaExecucao(dias, hora, minuto, base)` — prediz a próxima ocorrência localmente (sem libs extras), olha 14 dias à frente.
- `dispararAgora()` — mesma rotina do cron, ignora `ativo`. Usado pelo botão "Disparar agora".
- `statusAtual()` — `{ ativo, cronExpr }` em memória.

### `instrumentation.ts` (boot do Next.js)

Hook do Next.js que roda 1x quando o servidor sobe (`NEXT_RUNTIME==='nodejs'`). Importa `aplicarAgendamento` e registra o cron a partir da config gravada no DB. Habilitado via `experimental.instrumentationHook: true` no `next.config.mjs`.

### `lib/disparo-runner.ts::executarAgendamento`

Wrapper extraído do flow do `/api/run/route.ts`. Recebe `{ modo, placasIds?, origem }`. Quando `modo='selecionados'`, filtra `mapeaveis` por `atendimentoId`. Persiste cada envio em `Disparo` com `origem='AUTO'`. Retorna resumo `{ total, processados, enviadosOk, falhas, ignorados }`.

### Endpoints

| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/agendamento` | GET | Retorna estado completo (config + ultima exec + próxima exec calculada) |
| `/api/agendamento` | PATCH | Atualiza DB com Zod-validated body, **chama `aplicarAgendamento()`** pra re-registrar o cron |
| `/api/agendamento/run-now` | POST | Dispara `dispararAgora()` — mesma rotina, sem esperar cron |

### UI `/agendamento`

- Toggle ativo
- Chips dia da semana (Dom..Sáb) + atalhos "Dias úteis / Todos / Limpar"
- Inputs hora + minuto
- Card de modo: "Tudo do período" vs "Só placas selecionadas"
- Quando `modo='selecionados'`: lista filtrada de atendimentos do período padrão com checkbox por linha
- Sticky bar inferior: **Salvar** (só ativo se `dirty`) + **Disparar agora** (testa)
- Cards laterais: próxima execução (formatada como "ter 28/04 às 09:00"), última execução (com ok/falha/erro), explicação "Como funciona"
- Reusa `AutoRefresh` (3min) pra atualizar próxima/última exec

### Caveats / decisões

- **Singleton in-process:** se em produção rodar múltiplas instâncias do Next, cada uma registra o cron e dispara N vezes. Atual deploy é single-instance — se mudar, precisa migrar pra cron externo ou lock distribuído.
- **HMR:** em dev, mudanças de código fazem o módulo reload. `globalThis.__nacionalScheduler` preserva o task entre reloads, mas mudanças em `lib/scheduler.ts` resetam. Aceitável.
- **Timezone:** `proximaExecucao` usa hora local do servidor; UI mostra com fuso `America/Sao_Paulo`. `node-cron` também roda em hora local. Ajustar se hospedar fora do Brasil.
- **Simultaneidade:** se `dispararAgora()` é chamado enquanto o cron está rodando, ambos executam em paralelo (não há lock). Pode duplicar envios. **Phase 2:** adicionar lock simples por timestamp.
- O CLI runner (`src/index.ts`) continua existindo — útil pra rodar fora do web (ex: cron do sistema). Mas agora **não é mais o caminho recomendado** pra agendamento; a UI de `/agendamento` cobre o uso normal.

---

## 10. ResumoPainel (mini-BI reutilizável)

Painel de agregação + filtros + drill-down embutido em `/disparos`, `/historico` e `/agendamento`. Usuário pode ver de relance: **valor total, # prestadores distintos, # associações, # CNPJs**, e fatiar por qualquer um deles.

### Arquivos

- **`lib/resumo-types.ts`**: tipo `ItemResumo` (shape padrão), adapters `itemFromAtendimento` / `itemFromDisparo`, `calcKPIs`, `sliceBy(items, 'prestador'|'associacao'|'cnpj'|'status')`.
- **`app/components/ResumoPainel.tsx`**: componente client. Card colapsável com:
  - **5 KPIs** no topo (Itens, Valor total, Prestadores, Associações, CNPJs)
  - **Filtros** multi-select (associação/prestador/CNPJ) + range de valor; chips removíveis
  - **Tabs**: por Prestador / por Associação / por CNPJ (+ por Status só em historico)
  - **Drill-down**: clicar numa linha do slice toggleia o filtro correspondente — KPIs e slice recalculam
  - **Sub-rows expansíveis**: em "Por CNPJ" mostra os prestadores atrelados (resolve "1 CNPJ → N prestadores"); em "Por Associação" mostra os CNPJs sob ela.

### Padronização da fonte

| Tela | Fonte | Adapter |
|------|-------|---------|
| `/disparos` | `mapeaveis: AtendimentoView[]` + `manuais` | `itemFromAtendimento` |
| `/historico` | `items: DisparoRow[]` | `itemFromDisparo` |
| `/agendamento` | `atendimentos: AtendimentoOption[]` (ampliado pra incluir associacao/cnpj/valor/telefone) | inline mapping |

### Caveats

- **Histórico não tem `associacao`/`cnpj` no modelo `Disparo`**: por enquanto vêm vazios na fonte do /historico. KPIs de prestadores e valor funcionam; associação/CNPJ ficam zerados. **Phase 2:** adicionar colunas no model `Disparo` ao gravar disparo (já temos no atendimento).
- **Drill-down é interno ao painel**: por enquanto não propaga pra tabela principal (busca/filtros já existentes continuam separados). `onDrillDown` é exposto pra integração futura.
- **Performance**: 192 atendimentos / 500 disparos é nada. Tudo em `useMemo` client-side.

---

## Fontes

- PDF original: `api_cobranca.pdf` (no raiz do repo, referência local).
- Documentação Helena — getting started: https://helena.readme.io/reference/getting-started-with-your-api
- Documentação Helena — chatbot: https://helena.readme.io/reference/get_v1-chatbot
