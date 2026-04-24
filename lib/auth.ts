import { NextResponse } from 'next/server';

/**
 * Representa o usuário autenticado em uma requisição.
 * Campos extensíveis quando plugarmos NextAuth.
 */
export interface AuthUser {
  email: string;
  name?: string | null;
}

/**
 * STUB — enquanto NextAuth não foi plugado, lê cabeçalho `x-user-email` só em DEV.
 * Em produção, sempre retorna null (bloqueia o endpoint via `requireUser`).
 *
 * Depois que NextAuth entrar, esta função vai chamar `getServerSession()` e
 * verificar se `session.user.email ∈ ALLOWED_EMAILS`.
 */
export async function getCurrentUser(req: Request): Promise<AuthUser | null> {
  if (process.env.NODE_ENV !== 'production') {
    const devEmail = req.headers.get('x-user-email');
    if (devEmail) return { email: devEmail };
    // Em dev, se não houver header, assume "dev local" pra não travar o fluxo do time.
    return { email: 'dev@local' };
  }
  return null;
}

/**
 * Usar no topo de todo handler /api/* que muta estado.
 *   const user = await requireUser(req);
 *   if (user instanceof NextResponse) return user;
 *   // ... use user.email
 */
export async function requireUser(req: Request): Promise<AuthUser | NextResponse> {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }
  return user;
}

/** Extrai o IP do cliente, considerando proxies (Vercel injeta x-forwarded-for). */
export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}
