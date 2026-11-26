import { isPresetId } from '@/lib/prefs';
import { currentUser } from '@/server/session';
import { readPrefs, writePrefs } from '@/server/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const email = await currentUser();
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const prefs = await readPrefs(email);
  return Response.json(prefs ?? { presetId: null });
}

export async function PUT(request: Request) {
  const email = await currentUser();
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { presetId?: unknown } | null;
  if (!body || !isPresetId(body.presetId)) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  return Response.json(await writePrefs(email, body.presetId));
}
