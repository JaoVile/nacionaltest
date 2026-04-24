import { NextResponse } from 'next/server';
import { z, ZodError, ZodTypeAny } from 'zod';

export function zodErrorResponse(err: ZodError, msg = 'Payload inválido') {
  return NextResponse.json(
    {
      erro: msg,
      detalhes: err.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    },
    { status: 400 },
  );
}

export async function parseJsonBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<
  | { ok: true; data: z.infer<S> }
  | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { erro: 'JSON inválido no body' },
        { status: 400 },
      ),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: zodErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

export function parseSearchParams<S extends ZodTypeAny>(
  url: URL,
  schema: S,
):
  | { ok: true; data: z.infer<S> }
  | { ok: false; response: NextResponse } {
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, response: zodErrorResponse(parsed.error, 'Query string inválida') };
  }
  return { ok: true, data: parsed.data };
}
