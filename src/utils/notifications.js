// Per-page "unread" tracking + mute state for the Community and News &
// Insights sidebar badges. Same event-driven pattern as utils/theme.js:
// state lives in localStorage, changes are broadcast via a custom window
// event so the sidebar badge and the header mute button stay in sync
// without prop drilling.

const LAST_SEEN_PREFIX = 'borneo-tracker:last-seen:';
const MUTE_PREFIX = 'borneo-tracker:muted:';
export const NOTIF_CHANGE_EVENT = 'borneo-tracker:notif-change';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can fail (quota, private browsing) — badges just won't persist
    // across reloads for this session, which is an acceptable degradation.
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(NOTIF_CHANGE_EVENT));
}

/** Timestamp the user last had this page open, or null if never visited. */
export function getLastSeen(page) {
  const raw = safeGet(LAST_SEEN_PREFIX + page);
  return raw ? new Date(raw) : null;
}

/** Call when the page is opened — resets its sidebar badge to zero. */
export function markSeen(page) {
  safeSet(LAST_SEEN_PREFIX + page, new Date().toISOString());
  notify();
}

export function isMuted(page) {
  return safeGet(MUTE_PREFIX + page) === '1';
}

/** Muting a page suppresses its sidebar badge regardless of unread count. */
export function setMuted(page, muted) {
  safeSet(MUTE_PREFIX + page, muted ? '1' : '0');
  notify();
}
