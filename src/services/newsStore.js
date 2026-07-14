// Shared news store for the News Tracker MVP (AR-3, Plan A).
//
// There is no backend yet, so the seed articles in mockNews.js are treated as
// read-only, and every mutation (approve / reject / edit) is persisted as a
// small localStorage "overlay" keyed by article id — the SAME pattern the
// Community feature uses (see communityService.js). This lets the approval
// flow work end-to-end locally and survive reloads.
//
// When we wire the real backend (Supabase), only THIS file changes: the seed +
// overlay is replaced by table reads/writes. newsService.js (public) and
// adminNewsService.js (admin) keep their signatures, so no UI change is needed.

import { mockNewsArticles } from '../data/mockNews';

const STORAGE_KEY = 'borneo-tracker:news:v1';
const NETWORK_DELAY_MS = 150;

export const wait = () => new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));

// overlay shape: { [id]: { status?, title?, body?, publishedAt?, reviewedAt? } }
function loadOverlay() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverlay(overlay) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // Storage can fail (quota / private mode); the session still works, it just
    // won't persist across reloads. Approval is not safety-critical in the MVP.
  }
}

function applyOverlay(article, overlay) {
  const patch = overlay[article.id];
  return patch ? { ...article, ...patch } : article;
}

const byNewest = (a, b) =>
  new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);

/** Every article (all statuses), with overlay edits/status applied, newest first. */
export function getAllArticles() {
  const overlay = loadOverlay();
  return mockNewsArticles.map((article) => applyOverlay(article, overlay)).sort(byNewest);
}

/** Merge a patch onto one article's overlay entry and persist it. */
export function patchArticle(id, patch) {
  const overlay = loadOverlay();
  overlay[id] = { ...(overlay[id] || {}), ...patch };
  saveOverlay(overlay);
  const base = mockNewsArticles.find((article) => article.id === id);
  return base ? applyOverlay(base, overlay) : null;
}
