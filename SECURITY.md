# Segurança — Nacional Cobrança NF

Este documento descreve a postura de segurança do projeto e o que é responsabilidade do **código** vs. do **operador**. O código faz o que dá pra fazer em código; o operador precisa executar o resto.

---

## Modelo de ameaça resumido

A aplicação é um painel interno que:
- Lê dados de atendimentos da **API DevSul** (token bearer).
- Dispara mensagens de template via **AtomosChat** (token bearer + canal Meta).
- Grava registros de auditoria (`Disparo`, `AuditLog`) em Postgres.

**Impacto de comprometimento:**
- Token Atomos vazado → atacante dispara WhatsApp no nome da Nacional (custo + reputação).
- Token DevSul vazado → atacante lê dados de atendimentos (PII: placas, valores).
- Painel sem auth exposto → qualquer um dispara mensagem paga.

---

## O que o **código** entrega

| Controle | Onde | Observação |
|----------|------|------------|
| Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) | `next.config.mjs` | Aplicado em todas as rotas |
| Validação de input (zod) | `lib/api-validation.ts` + cada `app/api/*/route.ts` | 400 em payload inválido |
| Autenticação (esqueleto) | `lib/auth.ts` → `requireUser()` | **Ainda stub — ativar NextAuth antes do deploy** |
| Audit log | `lib/audit.ts` + modelo `AuditLog` | Grava user, ação, IP, UA, hash do payload |
| Mascaramento de tokens em GET /api/config | `app/api/config/route.ts` | Tokens sensíveis retornam `abc123••xyz` |
| SAST (CodeQL) | `.github/workflows/security.yml` | Push + PR + semanal |
| Dependency audit | GitHub Actions + Dependabot | Weekly, fail em high+ |
| Proibição de iframe (frame-ancestors none) | Header CSP | Bloqueia clickjacking |

---

## O que é responsabilidade do **operador**

### 1. Credenciais e secrets

| Secret | Onde guardar | Rotação |
|--------|--------------|---------|
| `DEVSUL_BEARER_TOKEN` | Vercel Project Env Vars (Production + Preview) | A cada 90 dias ou suspeita de vazamento |
| `ATOMOS_BEARER_TOKEN` | Vercel Project Env Vars | A cada 90 dias |
| `ATOMOS_CHANNEL_ID` | Vercel Project Env Vars | Só muda se trocar de canal Meta |
| `DATABASE_URL` (Neon) | Vercel Project Env Vars | Rotacionar se comprometido |
| `GITHUB_CLIENT_SECRET` | Vercel Project Env Vars | Rotacionar se comprometido |
| `NEXTAUTH_SECRET` | Vercel Project Env Vars | Gerado via `openssl rand -base64 32` |
| `ALLOWED_EMAILS` | Vercel Project Env Vars | Editar quando time muda |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel Project Env Vars | Rotacionar se comprometido |
| `CRON_SECRET` | Vercel Project Env Vars | Rotacionar a cada 180 dias |

**Regras:**
- **NUNCA** commitar `.env` real. `.env.example` tem apenas placeholders.
- **NUNCA** colar tokens em issues, PRs, Slack, Discord, ou qualquer chat com histórico.
- Se suspeitar de vazamento: **rotacionar imediatamente** o token comprometido e todos os derivados. Revogar no portal da DevSul/Atomos/GitHub.

### 2. Backup e recuperação

- **Neon Postgres** tem PITR (Point-in-Time Recovery) automático no plano free até 7 dias. Validar que está ativo em https://console.neon.tech → Project → Branches.
- Para histórico mais longo (compliance), exportar `AuditLog` para armazenamento separado mensalmente (snapshot CSV via job manual).
- **Teste de restauração** a cada trimestre: criar branch a partir de um snapshot de 7 dias atrás e confirmar que a tabela `Disparo` está íntegra.

### 3. Controle de acesso

- Lista de emails autorizados vive em `ALLOWED_EMAILS` (env var no Vercel, CSV). Ex: `caio@nacional.com,outra@nacional.com`.
- Adicionar/remover pessoa:
  1. Editar `ALLOWED_EMAILS` no Vercel.
  2. Redeploy (automático em Vercel quando env vars mudam).
  3. Registrar a mudança no log de alterações de acesso (planilha interna).
- Auth é via **GitHub OAuth** — só funciona se a pessoa tiver conta GitHub com o email listado.

### 4. Patching

- **Dependabot** abre PRs semanalmente para updates npm + GitHub Actions.
- **Regra:** PR de security advisory (critical/high) deve ser mergeado em **≤ 48h**.
- **Regra:** PR de minor/patch sem advisory pode esperar até a próxima sprint.
- **Regra:** Major upgrades (ex: Next 14 → 15) exigem branch de teste e QA manual.
- Prisma major (5 → 7) está **ignorado** no Dependabot — requer migração manual.

### 5. Proteção do repositório GitHub

No GitHub → Settings → Branches → `main`:
- ✅ Require pull request before merging (min 1 aprovação).
- ✅ Require status checks: `Security / audit`, `Security / codeql`, `Security / typecheck`.
- ✅ Require branches to be up to date before merging.
- ✅ Do not allow force pushes.
- ✅ Do not allow deletions.
- ✅ Require signed commits (opcional mas recomendado).

No GitHub → Settings → Security:
- ✅ Secret scanning: **on**.
- ✅ Push protection: **on**.
- ✅ Dependency graph: **on**.
- ✅ Dependabot alerts: **on**.
- ✅ Code scanning (CodeQL): **on** (já vem do workflow).

### 6. Proteção do projeto Vercel

- ✅ Production deployment **só** pela branch `main`.
- ✅ Preview deployments **não** têm acesso ao Atomos de produção — usar um channel de testes ou manter `TEST_MODE=true` em Preview.
- ✅ Domínio customizado com HTTPS obrigatório (Vercel já faz).
- ✅ Ativar "Require Email" em Vercel Team Settings → Security.

---

## Procedimento em caso de incidente

**Se suspeitar que um token vazou ou alguém acessou algo que não devia:**

1. **Contenção imediata** (primeiros 15min):
   - Revogar o token suspeito no portal de origem (DevSul / Atomos / GitHub / Neon / Upstash).
   - Se foi vazamento de `ALLOWED_EMAILS` ou acesso indevido: remover o email da allowlist e redeploy.
   - Se foi vazamento no Git: `git push --force` **não resolve** — use https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository e considere o secret permanentemente comprometido.

2. **Triagem** (primeiras 2h):
   - Query em `AuditLog`:
     ```sql
     SELECT userEmail, action, ip, createdAt, metadata
     FROM "AuditLog"
     WHERE createdAt > NOW() - INTERVAL '7 days'
     ORDER BY createdAt DESC;
     ```
   - Verificar se houve disparos Atomos não-autorizados (valor somado no período).
   - Verificar logs do Vercel (Dashboard → Project → Logs) por IPs estranhos.

3. **Recuperação** (24-48h):
   - Rotacionar **todos** os secrets do Vercel (não só o suspeito).
   - Forçar logout de todos os usuários: rotacionar `NEXTAUTH_SECRET`.
   - Postar post-mortem interno.

4. **Contato:**
   - Responsável técnico: `[preencher]`
   - Responsável de negócio: `[preencher]`

---

## Reportar vulnerabilidade

Encontrou algo que parece um problema de segurança? **Não abra issue pública.** Envie email para `[preencher-email-de-seguranca]` com:
- Descrição do problema.
- Passos para reproduzir.
- Impacto estimado.

Resposta em até 72h.
