// Mock service for the Community page, following the same shape as
// newsService.js (simulated latency, async functions) so the two features
// read consistently. There is no backend yet, so writes persist to
// localStorage as a small "overlay" of mutations layered on top of the
// read-only seed posts in mockCommunityPosts.js — the seed data itself is
// never touched, which keeps it trivial to add/edit seed posts later without
// worrying about stale persisted copies.
//
// Attachment metadata lives in this localStorage overlay; the binary blobs live
// in IndexedDB via communityAttachmentStore. The two can't form a real atomic
// transaction across storages, so createPost/deletePost do best-effort cleanup
// at the point of the operation (plan §6.3).

import { mockCommunityPosts } from '../data/mockCommunityPosts';
import { kindForFile } from '../pages/community/communityUploadConfig';
import { saveAttachment, deleteAttachments } from './communityAttachmentStore';

const NETWORK_DELAY_MS = 200;
const STORAGE_KEY = 'borneo-tracker:community:v1';

// No auth in this app yet (see sidebar/MiniTopBar logout — authToken is never
// actually set). Every like/comment is attributed to this fixed demo identity.
export const CURRENT_USER = 'You';

const emptyOverlay = () => ({ posts: [], postLikes: {}, comments: {}, commentLikes: {} });

const wait = () => new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));

// Prefer a real UUID; fall back to a time+random id on older browsers. Never
// use Date.now() alone — rapid posts or multiple tabs could collide.
function makeId(prefix) {
  const unique =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}

function loadOverlay() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOverlay();
    return { ...emptyOverlay(), ...JSON.parse(raw) };
  } catch {
    return emptyOverlay();
  }
}

// Silent save: storage failures are swallowed. Used by likes/comments, where a
// lost write only costs this session's interaction and never a broken post.
function saveOverlay(overlay) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // Storage can fail (quota, private browsing) — the UI still works for
    // this session, it just won't survive a reload.
  }
}

// Strict save: throws on failure so create/delete flows can detect a quota or
// serialization error and roll back their attachment blobs (plan §6.3).
function saveOverlayStrict(overlay) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
}

// Best-effort blob cleanup — used on rollback and on delete. A failure here at
// worst leaves an orphan blob taking local quota; it never surfaces as an error.
async function safeDeleteAttachments(storageKeys) {
  if (!storageKeys.length) return;
  try {
    await deleteAttachments(storageKeys);
  } catch {
    // swallow: orphan cleanup is best-effort in this prototype
  }
}

function normalizeAttachments(attachments) {
  return Array.isArray(attachments) ? attachments : [];
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

// `canDelete` marks a user-created (overlay) post so the UI can offer Delete
// without guessing from the author string. Seed posts are read-only.
function hydratePost(post, overlay, canDelete = false) {
  const likeState = overlay.postLikes[post.id];
  const createdComments = overlay.comments[post.id] || [];
  const comments = [...post.comments, ...createdComments]
    .map((comment) => hydrateComment(comment, post.id, overlay))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    ...post,
    attachments: normalizeAttachments(post.attachments),
    likeCount: likeState ? likeState.likeCount : post.likeCount,
    likedByMe: likeState ? likeState.likedByMe : false,
    comments,
    commentCount: comments.length,
    canDelete,
  };
}

/** All posts (user-created first, then seed), newest first, fully hydrated with live like/comment state. */
export async function getPosts() {
  await wait();
  const overlay = loadOverlay();
  const userPosts = overlay.posts.map((post) => hydratePost(post, overlay, true));
  const seedPosts = mockCommunityPosts.map((post) => hydratePost(post, overlay, false));
  return [...userPosts, ...seedPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Create a post, optionally with File attachments. Blobs are saved to IndexedDB
 * first; only if they all succeed is the (serialisable) metadata written to the
 * overlay. Any failure best-effort rolls back this call's blobs so we never
 * leave a broken post or orphaned files.
 */
export async function createPost({ title, body, topic, territory, attachments = [] }) {
  await wait();

  const postId = makeId('post');
  const createdAt = new Date().toISOString();

  // 1. Persist blobs first, tracking saved keys for rollback.
  const savedKeys = [];
  const attachmentMeta = [];
  try {
    for (const file of attachments) {
      const kind = kindForFile(file);
      if (!kind) {
        // UI validates first; this guards against ever persisting a post that
        // references an unstorable file.
        throw new Error(`Unsupported attachment: ${file?.name || 'file'}`);
      }
      const storageKey = makeId('community-attachment');
      await saveAttachment({ storageKey, blob: file, createdAt });
      savedKeys.push(storageKey);
      attachmentMeta.push({
        id: makeId('attachment'),
        postId,
        kind,
        name: file.name,
        mimeType: file.type || '',
        size: file.size,
        storageKey,
        createdAt,
      });
    }
  } catch (err) {
    await safeDeleteAttachments(savedKeys);
    throw err;
  }

  // 2. Re-read the LATEST overlay (uploads take time; a concurrent like/comment
  //    may have written meanwhile), merge only the new post, then strict-save.
  const overlay = loadOverlay();
  const post = {
    id: postId,
    author: CURRENT_USER,
    title: title.trim(),
    body: body.trim(),
    topic,
    territory,
    createdAt,
    likeCount: 0,
    comments: [],
    attachments: attachmentMeta,
  };
  overlay.posts = [post, ...overlay.posts];
  try {
    saveOverlayStrict(overlay);
  } catch (err) {
    // Metadata write failed → roll back all new blobs so none are orphaned.
    await safeDeleteAttachments(savedKeys);
    throw err;
  }

  return hydratePost(post, overlay, true);
}

/**
 * Delete a user-created post. Removing the metadata is the source of truth for
 * "deleted"; the attachment blobs are then cleaned up best-effort. Seed posts
 * are read-only and cannot be deleted.
 */
export async function deletePost(postId) {
  await wait();
  const overlay = loadOverlay();
  const index = overlay.posts.findIndex((post) => post.id === postId);
  if (index === -1) {
    throw new Error(`Cannot delete post: ${postId} is not a user-created post.`);
  }

  const [removed] = overlay.posts.splice(index, 1);
  // Drop this post's like/comment overlay state too, so nothing dangles.
  delete overlay.postLikes[postId];
  delete overlay.comments[postId];
  saveOverlayStrict(overlay);

  const storageKeys = normalizeAttachments(removed.attachments)
    .map((attachment) => attachment.storageKey)
    .filter(Boolean);
  await safeDeleteAttachments(storageKeys);
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
    id: makeId('comment'),
    author: CURRENT_USER,
    body: body.trim(),
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };
  overlay.comments[postId] = [...(overlay.comments[postId] || []), comment];
  saveOverlay(overlay);
  return comment;
}
