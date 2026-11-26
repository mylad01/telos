/**
 * Telos reminder fan-out. Reads unsent rows from `public.telos_reminders` whose
 * `fire_at` has passed, sends a Web Push to the owner's stored subscription and
 * marks the row sent.
 *
 * Secrets to set before deploying (`supabase secrets set --env-file ...`):
 *   VAPID_PUBLIC_KEY   the application server key the browser subscribed with
 *   VAPID_PRIVATE_KEY  its private half
 *   VAPID_SUBJECT      a contact URL, e.g. mailto:you@example.com
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 *
 * Deploy with `supabase functions deploy remind`, then call it on a schedule
 * (pg_cron or any external cron) — every minute is plenty for a to-do list.
 */

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type WebPush = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: StoredSubscription,
    payload: string,
    options: { TTL: number },
  ): Promise<unknown>;
};

type Reminder = { id: number; user_id: string; task_id: string };

const WEBPUSH_MODULE = 'npm:web-push@3.6.7';
const BATCH = 100;
const TTL_SECONDS = 3600;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function serviceKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  return key;
}

function serviceUrl(): string {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('SUPABASE_URL is missing');
  return url;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const key = serviceKey();
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  headers.set('content-type', 'application/json');
  return await fetch(`${serviceUrl()}/rest/v1${path}`, { ...init, headers });
}

function isReminder(value: unknown): value is Reminder {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'number' &&
    typeof row.user_id === 'string' &&
    typeof row.task_id === 'string'
  );
}

async function dueReminders(): Promise<Reminder[]> {
  const now = encodeURIComponent(new Date().toISOString());
  const response = await rest(
    '/telos_reminders' +
      '?sent=eq.false' +
      `&fire_at=lte.${now}` +
      '&select=id,user_id,task_id' +
      '&order=fire_at.asc' +
      `&limit=${BATCH}`,
  );
  if (!response.ok) return [];
  const body = await response.json().catch(() => []);
  return Array.isArray(body) ? body.filter(isReminder) : [];
}

async function subscriptions(): Promise<Map<string, StoredSubscription>> {
  const response = await rest(
    '/telos_push_subscriptions?select=user_id,subscription',
  );
  const map = new Map<string, StoredSubscription>();
  if (!response.ok) return map;
  const body = await response.json().catch(() => []);
  if (!Array.isArray(body)) return map;
  for (const row of body) {
    if (typeof row !== 'object' || row === null) continue;
    const entry = row as Record<string, unknown>;
    const subscription = entry.subscription as StoredSubscription | undefined;
    if (typeof entry.user_id !== 'string' || !subscription?.endpoint) continue;
    map.set(entry.user_id, subscription);
  }
  return map;
}

async function taskTitles(reminders: Reminder[]): Promise<Map<string, string>> {
  const ids = [...new Set(reminders.map((reminder) => reminder.task_id))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const filter = encodeURIComponent(`(${ids.join(',')})`);
  const response = await rest(`/tasks?select=user_id,id,title&id=in.${filter}`);
  if (!response.ok) return map;
  const body = await response.json().catch(() => []);
  if (!Array.isArray(body)) return map;
  for (const row of body) {
    if (typeof row !== 'object' || row === null) continue;
    const entry = row as Record<string, unknown>;
    if (
      typeof entry.user_id === 'string' &&
      typeof entry.id === 'string' &&
      typeof entry.title === 'string'
    ) {
      map.set(`${entry.user_id}:${entry.id}`, entry.title);
    }
  }
  return map;
}

async function markSent(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await rest(`/telos_reminders?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify({ sent: true }),
  });
}

async function forgetSubscription(userId: string): Promise<void> {
  await rest(`/telos_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

Deno.serve(async () => {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) {
    return json({ error: 'missing VAPID env vars' }, 500);
  }

  const reminders = await dueReminders();
  if (reminders.length === 0) return json({ sent: 0 });

  const [byUser, titles] = await Promise.all([subscriptions(), taskTitles(reminders)]);
  const webpush = (await import(WEBPUSH_MODULE)).default as WebPush;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const sent: number[] = [];
  for (const reminder of reminders) {
    const subscription = byUser.get(reminder.user_id);
    if (!subscription) continue;
    const title = titles.get(`${reminder.user_id}:${reminder.task_id}`) ?? 'Telos reminder';
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body: 'Due now', tag: reminder.task_id }),
        { TTL: TTL_SECONDS },
      );
      sent.push(reminder.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410 mean the browser dropped the subscription; stop retrying it.
      if (status === 404 || status === 410) {
        sent.push(reminder.id);
        await forgetSubscription(reminder.user_id);
      }
    }
  }

  await markSent(sent);
  return json({ sent: sent.length });
});
