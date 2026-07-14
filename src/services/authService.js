// ADMIN auth — a thin wrapper over Supabase Auth for the /admin section.
//
// Env-gated, two modes (see supabaseClient.js):
//  • Supabase configured (keys set) → the admin side REQUIRES a real login
//    (email + password via Supabase Auth) and reads/writes the live news_items
//    table. RLS grants an authenticated admin full read + UPDATE.
//  • NOT configured (no keys — local dev + the vitest suite) → auth is bypassed
//    entirely. getSession() returns a truthy sentinel so callers treat
//    "no auth configured" as "already allowed", and the admin page runs on the
//    localStorage mock with no login. Nothing breaks with zero setup.

import { supabase, isSupabaseConfigured } from './supabaseClient';

// True when Supabase keys are set → the admin side requires login.
export const isAuthEnabled = isSupabaseConfigured;

// Sentinel session for mock mode: truthy so the gate reads as "allowed".
const MOCK_SESSION = { mock: true };

/** Sign in with email + password. Returns { error } (null error on success). */
export async function signIn(email, password) {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

/** Sign the current admin out. No-op in mock mode. */
export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Current session, or null. In mock mode returns a truthy sentinel. */
export async function getSession() {
  if (!supabase) return MOCK_SESSION;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

/**
 * Subscribe to auth state changes; `callback` receives the session (or null).
 * Returns an unsubscribe function. No-op unsubscribe in mock mode.
 */
export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data?.subscription?.unsubscribe();
}
