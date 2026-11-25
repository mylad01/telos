import { parseTask, type Task } from '@/lib/tasks';
import { currentUser } from '@/server/session';
import { syncTasks } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const email = await currentUser();
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { since?: unknown; changes?: unknown }
    | null;
  if (!body || !Array.isArray(body.changes) || body.changes.length > 5000) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  const changes = body.changes
    .map(parseTask)
    .filter((task): task is Task => task !== null);
  const since =
    typeof body.since === 'number' && Number.isFinite(body.since)
      ? Math.max(0, Math.floor(body.since))
      : 0;

  const result = await syncTasks(email, since, changes);
  if (!result) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return Response.json(result);
}
