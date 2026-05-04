# Setup de credenciais externas — passo a passo

Este guia te leva pelos 3 itens externos que faltam pra eu terminar a revisão técnica:

1. **Neon Postgres** (banco) — ~10 min
2. **Google OAuth** (login) — ~15 min
3. **`NEXTAUTH_SECRET`** (assina os JWTs) — ~30 segundos

No fim, você vai ter editado o `.env` com 6 valores novos. Me avisa quando terminar e eu rodo as Fases 1 e 2.

> **Importante de segurança:** **NÃO cole os tokens completos neste chat.** Edite o `.env` local você mesmo (ou cole só os primeiros 6 chars de cada pra eu confirmar que estão presentes).

---

## Parte 1 — Neon Postgres

### 1.1 Criar conta

1. Abrir https://console.neon.tech
2. **Sign up with Google** usando `your@email.com` (mais rápido que email/senha)
3. Aceitar os termos. Free tier é o "Hobby" — 0,5 GB de storage e 1 compute-hour de uso autosuspendido. Sobra muito pro projeto.

### 1.2 Criar o projeto

Na primeira tela após login, "Create your first project":

- **Project name:** `nacional`
- **Postgres version:** `16` (default — não mudar)
- **Region:** **AWS — São Paulo (sa-east-1)**
  - 🚨 **Importante:** escolher Brasil para LGPD (dados pessoais em território nacional). Não usar US East.
- **Database name:** `nacional` (ou deixar `neondb`)

Clicar **Create project**.

### 1.3 Copiar as connection strings

Após criação, vai aparecer um modal com a connection string. Se fechar, é só ir em **Dashboard → Connection Details** no menu lateral.

Você precisa de **DUAS strings diferentes**:

#### A) `DATABASE_URL` (com pooler, p/ runtime)

- Em "Connection string", **deixe marcado** "Pooled connection" (vem por padrão).
- Vai parecer com:
  ```
  postgresql://nacional_owner:abcDEF123@ep-xxx-yyy-pooler.sa-east-1.aws.neon.tech/nacional?sslmode=require
  ```
- **Adicionar no final:** `&pgbouncer=true&connection_limit=1` — fica:
  ```
  postgresql://nacional_owner:abcDEF123@ep-xxx-yyy-pooler.sa-east-1.aws.neon.tech/nacional?sslmode=require&pgbouncer=true&connection_limit=1
  ```
- Copiar. Esse vai pro `.env` como `DATABASE_URL`.

#### B) `DIRECT_URL` (sem pooler, p/ migrations)

- Na mesma tela, **desmarcar** "Pooled connection". Aparece outra string.
- Vai parecer com (note: SEM `-pooler` no host):
  ```
  postgresql://nacional_owner:abcDEF123@ep-xxx-yyy.sa-east-1.aws.neon.tech/nacional?sslmode=require
  ```
- Copiar. Esse vai pro `.env` como `DIRECT_URL`. **Sem** o `pgbouncer=true` no final.

### 1.4 (Opcional) Branch de testes

Pra suite de testes não tocar no banco principal:

1. Menu lateral → **Branches** → **Create branch**
2. Name: `test`
3. From: `main`
4. Create
5. Selecionar a branch `test` no topo → copiar a connection string da mesma forma. Vai pro `.env` como `DATABASE_URL_TEST`.

> Se quiser pular essa parte, eu uso `main` mesmo nos testes (com `TRUNCATE` antes de cada arquivo). Funciona mas mistura dados de teste com os reais.

### 1.5 Validar

No terminal local (bash/WSL):
```bash
psql "<DIRECT_URL>" -c "select version();"
```

Se vier algo tipo `PostgreSQL 16.x on x86_64-pc-linux-gnu...` está ok. Se der "psql: command not found", instalar via [Postgres.app](https://postgresapp.com/) ou pular — não é obrigatório, eu valido depois.

---

## Parte 2 — Google OAuth

Mais passos, mas cada um é simples. Dá pra seguir sem instalar nada.

### 2.1 Criar projeto Google Cloud

1. Abrir https://console.cloud.google.com
2. Logar com `your@email.com`
3. **No topo da página**, ao lado do logo "Google Cloud", clicar no dropdown de projetos
4. **New Project**
   - Project name: `nacional-painel`
   - Location: deixar default ("No organization")
   - Create
5. Aguardar uns 10s, vai aparecer notificação "Project created". Clicar em **Select project** ou trocar manualmente no dropdown.

### 2.2 Configurar OAuth Consent Screen

Esse passo descreve pra qual app o usuário está dando permissão. **Tem que fazer antes de criar o client.**

1. Menu lateral (☰) → **APIs & Services** → **OAuth consent screen**
2. **User Type:** selecionar **External** → Create
   - "Internal" só funciona com Workspace; Gmail comum precisa External
3. **Página 1 — App information:**
   - App name: `Nacional Cobrança NF`
   - User support email: `your@email.com`
   - App logo: deixar em branco
   - **Application home page**, **Application privacy policy**, **Application terms**: deixar em branco (são opcionais)
   - Authorized domains: deixar em branco (preencheria se publicasse)
   - Developer contact information: `your@email.com`
   - **Save and Continue**
4. **Página 2 — Scopes:**
   - Clicar **Add or Remove Scopes**
   - Marcar:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - **Update** → **Save and Continue**
5. **Página 3 — Test users:**
   - Clicar **+ Add users**
   - Adicionar `your@email.com`
   - (Adicionar qualquer outro email que vai entrar no painel — esses serão a allowlist)
   - **Save and Continue**
6. **Página 4 — Summary:** Back to Dashboard

> **Status "Testing":** o app fica com esse status indefinidamente, e só os emails em "Test users" conseguem logar. **Pra uso interno isso é suficiente** — não precisa publicar nem passar por verificação do Google.

### 2.3 Criar OAuth Client ID

1. Menu lateral → **APIs & Services** → **Credentials**
2. **+ Create Credentials** (botão no topo) → **OAuth client ID**
3. **Application type:** Web application
4. **Name:** `nacional-web` (ou qualquer nome — só interno)
5. **Authorized JavaScript origins:**
   - Clicar **+ Add URI**
   - `http://localhost:3000`
   - (Se já tiver URL de produção, adicionar também: `https://seu-dominio.com`)
6. **Authorized redirect URIs:**
   - Clicar **+ Add URI**
   - `http://localhost:3000/api/auth/callback/google`
   - (Produção: `https://seu-dominio.com/api/auth/callback/google`)
7. **Create**

### 2.4 Copiar Client ID e Client Secret

Modal aparece com 2 valores:

- **Your Client ID** → copiar inteiro. Vai pro `.env` como `GOOGLE_CLIENT_ID` (formato: `123456789-abc...apps.googleusercontent.com`)
- **Your Client Secret** → copiar inteiro. Vai pro `.env` como `GOOGLE_CLIENT_SECRET` (formato: `GOCSPX-abc123...`)

Pode fechar o modal — se perder o secret, em Credentials → clicar no nome do client → "Reset Secret" gera novo.

### 2.5 Definir `NEXTAUTH_URL`

Vai pro `.env` como:
```
NEXTAUTH_URL=http://localhost:3000
```

(Em produção depois trocar pra URL real, ex: `https://nacional.empresa.com`)

---

## Parte 3 — `NEXTAUTH_SECRET`

Gera local. Escolher 1 das opções abaixo conforme seu shell:

### Opção A — Git Bash / WSL / Linux / Mac

```bash
openssl rand -base64 32
```

Output exemplo: `Gv4QoX3kK1nE8wYr5J0Tj7H9bP2cZsM1dV6lA0=N4uI=`

### Opção B — PowerShell (Windows)

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Opção C — Node.js (se tiver instalado)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia o output. Vai pro `.env` como `NEXTAUTH_SECRET`. **Nunca compartilhar** — se vazar, qualquer um forja JWT válido.

---

## Parte 4 — `ALLOWED_EMAILS`

Lista CSV (separada por vírgula, sem espaços) dos emails autorizados a logar.

Mínimo: `your@email.com`. Adicionar quem mais usa o painel.

Exemplo:
```
ALLOWED_EMAILS=your@email.com,outro@nacional.com
```

> Esses emails têm que estar **também** em "Test users" do Google OAuth (Parte 2.2.5) — senão o Google bloqueia o login antes mesmo de chegar no NextAuth.

---

## Parte 5 — Editar o `.env`

Abrir `C:\JMdev\github\nacional\.env` (criar se não existir, copiando de `.env.example`) e adicionar/atualizar estas linhas no final:

```bash
# === Postgres (Neon) ===
DATABASE_URL=postgresql://nacional_owner:SENHA@ep-xxx-pooler.sa-east-1.aws.neon.tech/nacional?sslmode=require&pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://nacional_owner:SENHA@ep-xxx.sa-east-1.aws.neon.tech/nacional?sslmode=require

# (opcional — se criou branch de teste)
DATABASE_URL_TEST=postgresql://nacional_owner:SENHA@ep-yyy-pooler.sa-east-1.aws.neon.tech/nacional?sslmode=require&pgbouncer=true&connection_limit=1

# === NextAuth ===
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<output do openssl rand -base64 32>
GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxx
ALLOWED_EMAILS=your@email.com
```

A linha antiga `DATABASE_URL="file:./prisma/dev.db"` pode ficar comentada ou apagar — vou substituir.

---

## Parte 6 — Me avisar

Quando terminar, é só me dizer aqui no chat:

> "pronto, .env atualizado"

Eu vou:
1. Validar (lendo o `.env` localmente — não vou exibir os valores)
2. Rodar `prisma migrate dev` contra Neon
3. Importar dados do SQLite com o script de migração
4. Plugar NextAuth
5. Rodar a suite de testes completa
6. Te chamar pra logar via Google e validar

Se der algum erro nos passos acima (Neon ou Google), me cola **a mensagem de erro** (não o token!) que eu ajudo.

---

## Checklist final

- [ ] Conta Neon criada
- [ ] Projeto `nacional` criado em `sa-east-1`
- [ ] `DATABASE_URL` (com `-pooler` + `&pgbouncer=true&connection_limit=1`) copiado
- [ ] `DIRECT_URL` (sem `-pooler`) copiado
- [ ] (Opcional) Branch `test` criada
- [ ] Projeto Google Cloud `nacional-painel` criado
- [ ] OAuth consent screen configurado (External, escopo email/profile/openid, Test user `your@email.com`)
- [ ] OAuth Client ID criado com redirect `http://localhost:3000/api/auth/callback/google`
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` copiados
- [ ] `NEXTAUTH_SECRET` gerado via `openssl rand -base64 32`
- [ ] `.env` atualizado com todas as variáveis acima
- [ ] Avisar no chat: "pronto, .env atualizado"

---

## Troubleshooting — erros comuns

### "redirect_uri_mismatch" no login Google
- O redirect no `.env` (`NEXTAUTH_URL` + `/api/auth/callback/google`) **tem que bater exatamente** com o que está em "Authorized redirect URIs" do OAuth Client.
- Trailing slash importa. `http://localhost:3000/` ≠ `http://localhost:3000`.
- Solução: editar o OAuth Client em Credentials → adicionar/remover URI.

### "access_denied" no login Google
- Email não está em "Test users". Voltar em OAuth consent screen → Test users → adicionar.

### Neon "endpoint is in idle state"
- Free tier autossuspende após 5min sem uso. Primeira requisição demora ~500ms-2s pra acordar. Normal.

### Prisma "Error: P1001 Can't reach database server"
- Verificar `sslmode=require` no fim da `DATABASE_URL`. Neon exige TLS.

### "PrismaClientInitializationError: prepared statement already exists"
- Sintoma de pool com pgbouncer sem `pgbouncer=true&connection_limit=1`. Adicionar esses 2 query params na `DATABASE_URL` (não na `DIRECT_URL`).

### `openssl: command not found`
- No Windows sem Git Bash, usar a Opção B (PowerShell) ou C (Node).
