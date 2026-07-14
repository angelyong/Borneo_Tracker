// ADMIN news service — what the /admin/news review queue reads and writes.
// Unlike the public service, this sees ALL statuses and can mutate them.
// In the MVP there is no real admin auth yet (that ships with the future admin
// section); this service just talks to the shared localStorage store. When we
// wire Supabase, only newsStore.js changes — these signatures stay the same.

import { getAllArticles, patchArticle, wait } from './newsStore';

export const NEWS_STATUSES = ['pending', 'published', 'rejected'];

/** All drafts/articles, every status, newest first. */
export async function getAllNews() {
  await wait();
  return getAllArticles();
}

/** Only items awaiting a decision. */
export async function getPendingDrafts() {
  await wait();
  return getAllArticles().filter((article) => article.status === 'pending');
}

export async function getNewsById(id) {
  await wait();
  return getAllArticles().find((article) => article.id === id) || null;
}

/** Approve as-is → goes live on the public page. */
export async function approveNews(id) {
  await wait();
  return patchArticle(id, {
    status: 'published',
    publishedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
  });
}

/** Reject → kept for audit, never shown publicly. */
export async function rejectNews(id) {
  await wait();
  return patchArticle(id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
  });
}

/** Save admin edits to the title/body (does not change status by itself). */
export async function updateNews(id, { title, body }) {
  await wait();
  const patch = { reviewedAt: new Date().toISOString() };
  if (typeof title === 'string') patch.title = title;
  if (typeof body === 'string') patch.body = body;
  return patchArticle(id, patch);
}

/** Save edits AND publish in one step — the edited text is what goes live. */
export async function publishEditedNews(id, { title, body }) {
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
