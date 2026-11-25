import { clearSession, currentUser, issueSession } from '@/server/session';
import { createAccount, verifyAccount } from '@/server/store';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  return Response.json({ email: await currentUser() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; email?: unknown; password?: unknown }
    | null;
  if (!body) return Response.json({ error: 'invalid' }, { status: 400 });

  if (body.action === 'logout') {
    await clearSession();
    return Response.json({ ok: true });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return Response.json({ error: 'email' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return Response.json({ error: 'password' }, { status: 400 });
  }

  if (body.action === 'signup') {
    const created = await createAccount(email, password);
    if (created === 'exists') return Response.json({ error: 'exists' }, { status: 409 });
  } else if (body.action === 'login') {
    if (!(await verifyAccount(email, password))) {
      return Response.json({ error: 'invalid' }, { status: 401 });
    }
  } else {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  await issueSession(email);
  return Response.json({ ok: true, email });
}
