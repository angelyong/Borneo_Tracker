// PUBLIC news service — what the /news pages read.
// Only PUBLISHED articles are ever returned here; pending/rejected drafts never
// reach the public site. In production this comes LIVE from Supabase (anon key +
// RLS: anon can only read published rows); in local dev it falls back to the mock
// store. getPublishedArticles() hides which backend is in use.

import { getPublishedArticles } from './newsStore';

export async function getNewsArticles() {
  return getPublishedArticles();
}

export async function getNewsArticleById(id) {
  const published = await getPublishedArticles();
  return published.find((article) => article.id === id) || null;
}

export async function getRelatedNewsArticles(article, limit = 3) {
  if (!article) return [];

  const published = await getPublishedArticles();
  return published
    .filter((candidate) => candidate.id !== article.id)
    .filter(
      (candidate) =>
        candidate.beat === article.beat ||
        candidate.country === article.country ||
        candidate.territories?.some((t) => article.territories?.includes(t))
    )
    .slice(0, limit);
}
