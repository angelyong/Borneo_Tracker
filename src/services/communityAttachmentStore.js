// IndexedDB adapter for Community attachment blobs. This is the ONLY place that
// touches the browser database — the UI and communityService talk to these
// functions, never to IndexedDB directly, so a future backend can replace just
// this file (plan §7.2, §13).
//
// Records are stored as { storageKey, blob, createdAt }, keyed by storageKey.
// localStorage (in communityService) holds the small, serialisable attachment
// metadata; the heavy binary lives here.

const DB_NAME = 'borneo-tracker-community';
const DB_VERSION = 1;
const STORE = 'attachments';

// A single error type with a machine-readable `code` so callers can tell apart
// "browser can't do this" from "storage is full" and surface the right message.
export class AttachmentStoreError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'AttachmentStoreError';
    this.code = code; // 'unsupported' | 'blocked' | 'quota' | 'io'
    if (cause) this.cause = cause;
  }
}

function getIndexedDB() {
  const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
  if (!idb) {
    throw new AttachmentStoreError('unsupported', 'This browser does not support offline attachment storage (IndexedDB).');
  }
  return idb;
}

// Translate a DOMException from IndexedDB into an AttachmentStoreError.
function mapError(domError, fallbackMessage) {
  const name = domError?.name;
  if (name === 'QuotaExceededError') {
    return new AttachmentStoreError('quota', 'Storage is full — the attachment could not be saved.', domError);
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return new AttachmentStoreError('blocked', 'The browser blocked access to attachment storage (e.g. private mode).', domError);
  }
  if (domError instanceof AttachmentStoreError) return domError;
  return new AttachmentStoreError('io', fallbackMessage, domError);
}

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = getIndexedDB().open(DB_NAME, DB_VERSION);
    } catch (err) {
      dbPromise = null; // allow a later retry
      reject(mapError(err, 'Could not open attachment storage.'));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'storageKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(mapError(request.error, 'Could not open attachment storage.'));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new AttachmentStoreError('blocked', 'Attachment storage is blocked by another open tab.'));
    };
  });
  return dbPromise;
}

/** Persist one attachment blob. Resolves once the write is durably committed. */
export async function saveAttachment({ storageKey, blob, createdAt }) {
  if (!storageKey || !blob) {
    throw new AttachmentStoreError('io', 'saveAttachment requires a storageKey and a blob.');
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put({ storageKey, blob, createdAt: createdAt ?? null });
      req.onerror = () => reject(mapError(req.error, 'Could not save the attachment.'));
    } catch (err) {
      reject(mapError(err, 'Could not save the attachment.'));
      return;
    }
    tx.oncomplete = () => resolve({ storageKey, createdAt: createdAt ?? null });
    tx.onabort = () => reject(mapError(tx.error, 'Saving the attachment was aborted.'));
  });
}

/** Read one attachment blob, or null if it is not stored. */
export async function getAttachment(storageKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = db.transaction(STORE, 'readonly').objectStore(STORE).get(storageKey);
    } catch (err) {
      reject(mapError(err, 'Could not read the attachment.'));
      return;
    }
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => reject(mapError(req.error, 'Could not read the attachment.'));
  });
}

/** Delete one attachment. Resolves even if the key did not exist. */
export async function deleteAttachment(storageKey) {
  return deleteAttachments([storageKey]);
}

/** Delete many attachments in a single transaction. No-op for an empty list. */
export async function deleteAttachments(storageKeys = []) {
  if (!storageKeys.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      storageKeys.forEach((key) => store.delete(key));
    } catch (err) {
      reject(mapError(err, 'Could not delete attachments.'));
      return;
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(mapError(tx.error, 'Could not delete attachments.'));
  });
}

/**
 * Lightweight listing of stored records ({ storageKey, createdAt }) without
 * exposing blobs. Optional — only a future orphan-reconciliation pass needs it
 * (plan §7.2); v1 does not depend on it.
 */
export async function listAttachmentRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    } catch (err) {
      reject(mapError(err, 'Could not list attachments.'));
      return;
    }
    req.onsuccess = () =>
      resolve((req.result || []).map((r) => ({ storageKey: r.storageKey, createdAt: r.createdAt })));
    req.onerror = () => reject(mapError(req.error, 'Could not list attachments.'));
  });
}

/**
 * Best-effort request for durable storage so the browser is less likely to
 * evict our blobs under pressure (plan §2.3). Never throws.
 */
export async function requestPersistentStorage() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // best-effort only — persistence is a nice-to-have, not a requirement
  }
  return false;
}
