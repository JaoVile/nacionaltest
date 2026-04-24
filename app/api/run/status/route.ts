import { NextRequest, NextResponse } from 'next/server';
import { getRunState } from '../../../../lib/run-state';
import { requireUser } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authed = await requireUser(req);
  if (authed instanceof NextResponse) return authed;
  return NextResponse.json(getRunState());
}
