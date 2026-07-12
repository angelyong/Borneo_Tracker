// Mock service for the Community page, following the same shape as
// newsService.js (simulated latency, async functions) so the two features
// read consistently. There is no backend yet, so writes persist to
// localStorage as a small "overlay" of mutations layered on top of the
// read-only seed posts in mockCommunityPosts.js — the seed data itself is
// never touched, which keeps it trivial to add/edit seed posts later without
// worrying about stale persisted copies.

import { mockCommunityPosts } from '../data/mockCommunityPosts';

const NETWORK_DELAY_MS = 200;
const STORAGE_KEY = 'borneo-tracker:community:v1';

// No auth in this app yet (see sidebar/MiniTopBar logout — authToken is never
// actually set). Every like/comment is attributed to this fixed demo identity.
export const CURRENT_USER = 'You';

const emptyOverlay = () => ({ posts: [], postLikes: {}, comments: {}, commentLikes: {} });

const wait = () => new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));

function loadOverlay() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOverlay();
    return { ...emptyOverlay(), ...JSON.parse(raw) };
  } catch {
    return emptyOverlay();
  }
}

function saveOverlay(overlay) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // Storage can fail (quota, private browsing) — the UI still works for
    // this session, it just won't survive a reload.
  }
}

function findBasePost(postId, overlay) {
  return overlay.posts.find((post) => post.id === postId) || mockCommunityPosts.find((post) => post.id === postId) || null;
}

function findBaseComment(postId, commentId, overlay) {
  const seedPost = mockCommunityPosts.find((post) => post.id === postId);
  const seedComment = seedPost?.comments.find((comment) => comment.id === commentId);
  if (seedComment) return seedComment;

  const createdComments = overlay.comments[postId] || [];
  return createdComments.find((comment) => comment.id === commentId) || null;
}

function hydrateComment(comment, postId, overlay) {
  const likeState = overlay.commentLikes[comment.id];
  return {
    ...comment,
    likeCount: likeState ? likeState.likeCount : comment.likeCount,
    likedByMe: likeState ? likeState.likedByMe : false,
  };
}

function hydratePost(post, overlay) {
  const likeState = overlay.postLikes[post.id];
  const createdComments = overlay.comments[post.id] || [];
  const comments = [...post.comments, ...createdComments]
    .map((comment) => hydrateComment(comment, post.id, overlay))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    ...post,
    likeCount: likeState ? likeState.likeCount : post.likeCount,
    likedByMe: likeState ? likeState.likedByMe : false,
    comments,
    commentCount: comments.length,
  };
}

/** All posts (user-created first, then seed), newest first, fully hydrated with live like/comment state. */
export async function getPosts() {
  await wait();
  const overlay = loadOverlay();
  const allPosts = [...overlay.posts, ...mockCommunityPosts].map((post) => hydratePost(post, overlay));
  return allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createPost({ title, body, topic, territory }) {
  await wait();
  const overlay = loadOverlay();
  const post = {
    id: `post-${Date.now()}`,
    author: CURRENT_USER,
    title: title.trim(),
    body: body.trim(),
    topic,
    territory,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    comments: [],
  };
  overlay.posts = [post, ...overlay.posts];
  saveOverlay(overlay);
  return hydratePost(post, overlay);
}

export async function toggleLikePost(postId) {
  await wait();
  const overlay = loadOverlay();
  const base = findBasePost(postId, overlay);
  if (!base) throw new Error(`Post not found: ${postId}`);

  const existing = overlay.postLikes[postId];
  const baseLikeCount = existing ? existing.likeCount : base.likeCount;
  const likedByMe = !(existing ? existing.likedByMe : false);

  overlay.postLikes[postId] = { likeCount: baseLikeCount + (likedByMe ? 1 : -1), likedByMe };
  saveOverlay(overlay);
  return overlay.postLikes[postId];
}

export async function toggleLikeComment(postId, commentId) {
  await wait();
  const overlay = loadOverlay();
  const base = findBaseComment(postId, commentId, overlay);
  if (!base) throw new Error(`Comment not found: ${commentId}`);

  const existing = overlay.commentLikes[commentId];
  const baseLikeCount = existing ? existing.likeCount : base.likeCount;
  const likedByMe = !(existing ? existing.likedByMe : false);

  overlay.commentLikes[commentId] = { likeCount: baseLikeCount + (likedByMe ? 1 : -1), likedByMe };
  saveOverlay(overlay);
  return overlay.commentLikes[commentId];
}

export async function addComment(postId, body) {
  await wait();
  const overlay = loadOverlay();
  const comment = {
    id: `comment-${Date.now()}`,
    author: CURRENT_USER,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };
  overlay.comments[postId] = [...(overlay.comments[postId] || []), comment];
  saveOverlay(overlay);
  return comment;
}
