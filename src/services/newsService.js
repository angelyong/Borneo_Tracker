// PUBLIC news service — what the /news pages read.
// Only PUBLISHED articles are ever returned here; pending/rejected drafts never
// reach the public site (this is the "nothing is public until an admin approves"
// gate, enforced in code today and by Supabase RLS later).

import { getAllArticles, wait } from './newsStore';

const published = () => getAllArticles().filter((article) => article.status === 'published');

export async function getNewsArticles() {
  await wait();
  return published();
}

export async function getNewsArticleById(id) {
  await wait();
  return published().find((article) => article.id === id) || null;
}

export async function getRelatedNewsArticles(article, limit = 3) {
  await wait();
  if (!article) return [];

  return published()
    .filter((candidate) => candidate.id !== article.id)
    .filter(
      (candidate) =>
        candidate.beat === article.beat ||
        candidate.country === article.country ||
        candidate.territories?.some((t) => article.territories?.includes(t))
    )
    .slice(0, limit);
}
