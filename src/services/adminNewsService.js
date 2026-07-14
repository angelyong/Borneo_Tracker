// ADMIN news service — what the /admin/news review queue reads and writes.
// Unlike the public service, this sees ALL statuses and can mutate them.
//
// Env-gated, two modes (see supabaseClient.js):
//  • Supabase configured → reads/writes the LIVE news_items table. RLS lets an
//    authenticated admin see every row (all statuses) and UPDATE them.
//  • NOT configured → the original localStorage mock (below), so local dev and
//    the vitest suite (which run with no keys) keep working with no login.
// Signatures never change, so NewsReview.jsx / DraftCard.jsx need no edits.

import { supabase } from './supabaseClient';
import { getAllArticles, patchArticle, wait } from './newsStore';

export const NEWS_STATUSES = ['pending', 'published', 'rejected'];

const TABLE = 'news_items';

// Map a Supabase row (snake_case) to the frontend article shape. Mirrors
// newsStore.mapRow (that copy is module-private and not exported).
function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    imageUrl: row.image_url || '',
    beat: row.beat,
    beatLabel: row.beat_label,
    esgPillar: row.esg_pillar,
    sdg: row.sdg || [],
    country: row.country,
    territories: row.territories || [],
    sources: row.sources || [],
    sourceCount: row.source_count ?? (row.sources ? row.sources.length : 0),
    originalLang: row.original_lang,
    aiGenerated: row.ai_generated,
    status: row.status,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

// Surface the Supabase error message so the UI's existing catch/alert shows it.
function orThrow(error) {
  if (error) throw new Error(error.message);
}

/** All drafts/articles, every status, newest first. */
export async function getAllNews() {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    orThrow(error);
    return (data || []).map(mapRow);
  }
  await wait();
  return getAllArticles();
}

/** Only items awaiting a decision. */
export async function getPendingDrafts() {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    orThrow(error);
    return (data || []).map(mapRow);
  }
  await wait();
  return getAllArticles().filter((article) => article.status === 'pending');
}

export async function getNewsById(id) {
  if (supabase) {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    orThrow(error);
    return data ? mapRow(data) : null;
  }
  await wait();
  return getAllArticles().find((article) => article.id === id) || null;
}

/** Approve as-is → goes live on the public page. */
export async function approveNews(id) {
  if (supabase) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'published', published_at: now, reviewed_at: now })
      .eq('id', id)
      .select()
      .maybeSingle();
    orThrow(error);
    return data ? mapRow(data) : null;
  }
  await wait();
  return patchArticle(id, {
    status: 'published',
    publishedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
  });
}

/** Reject → kept for audit, never shown publicly. */
export async function rejectNews(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    orThrow(error);
    return data ? mapRow(data) : null;
  }
  await wait();
  return patchArticle(id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
  });
}

/** Save admin edits to the title/body (does not change status by itself). */
export async function updateNews(id, { title, body }) {
  if (supabase) {
    const patch = { reviewed_at: new Date().toISOString() };
    if (typeof title === 'string') patch.title = title;
    if (typeof body === 'string') patch.body = body;
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    orThrow(error);
    return data ? mapRow(data) : null;
  }
  await wait();
  const patch = { reviewedAt: new Date().toISOString() };
  if (typeof title === 'string') patch.title = title;
  if (typeof body === 'string') patch.body = body;
  return patchArticle(id, patch);
}

/** Save edits AND publish in one step — the edited text is what goes live. */
export async function publishEditedNews(id, { title, body }) {
  if (supabase) {
    const now = new Date().toISOString();
    const patch = { status: 'published', published_at: now, reviewed_at: now };
    if (typeof title === 'string') patch.title = title;
    if (typeof body === 'string') patch.body = body;
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    orThrow(error);
    return data ? mapRow(data) : null;
  }
  await wait();
  const patch = {
    status: 'published',
    publishedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
  };
  if (typeof title === 'string') patch.title = title;
  if (typeof body === 'string') patch.body = body;
  return patchArticle(id, patch);
}
