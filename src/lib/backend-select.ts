import { nodeBackend } from './http-backend';
import { createSupabaseBackend } from './supabase/client';
import { supabaseConfig, type SyncBackend } from './sync-backend';

/**
 * Which backend this build talks to, decided once at build time:
 * Supabase settings present -> Supabase (works from a static export);
 * otherwise -> this app's own Node server.
 */
export function selectBackend(): SyncBackend {
  const config = supabaseConfig();
  return config ? createSupabaseBackend(config) : nodeBackend;
}

export const backend: SyncBackend = selectBackend();
