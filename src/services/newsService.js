import { mockNewsArticles } from '../data/mockNews';

const NETWORK_DELAY_MS = 250;

const wait = () => new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));

export async function getNewsArticles() {
  await wait();
  return [...mockNewsArticles];
}

export async function getNewsArticleById(id) {
  await wait();
  return mockNewsArticles.find((article) => article.id === id) || null;
}

export async function getRelatedNewsArticles(article, limit = 3) {
  await wait();
  if (!article) return [];

  return mockNewsArticles
    .filter((candidate) => candidate.id !== article.id)
    .filter(
      (candidate) =>
        candidate.territory === article.territory || candidate.category === article.category
    )
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}
