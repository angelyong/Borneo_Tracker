import { createClient } from '@supabase/supabase-js';

// Env-gated Supabase client for the LIVE news store.
//
// If VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set (production, or a local
// dev that opts in), the public /news page reads live published news from
// Supabase. If they are NOT set, `supabase` is null and everything falls back to
// the local mock store (src/data/mockNews.js + localStorage) — so local dev and
// the demo approval flow work with zero setup.
//
// The anon key is safe to ship in the browser: Row-Level Security lets anon read
// only `status = 'published'` rows. The service_role key (writes) is never here —
// it lives server-side in the pipeline / CI only.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
