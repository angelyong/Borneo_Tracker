// Single source of truth for every attachment upload rule — allowed formats,
// per-file and total size caps, per-kind counts, classification and validation.
// The picker UI, the create-post service and the post renderer all import from
// here so the rules can never drift out of sync (see plan §4, §7.1).
//
// Front-end validation only rejects the obviously-wrong. It is NOT a virus scan
// or a content-signature check — a real backend must re-validate on upload.

const MB = 1024 * 1024;

/* ---------- Limits (plan §4.2) ---------- */

export const MAX_ATTACHMENTS = 10; // per post, all kinds combined
export const MAX_IMAGES = 10; // per post
export const MAX_VIDEOS = 1; // per post

// Per-file size ceiling, keyed by kind.
export const MAX_BYTES_BY_KIND = {
  image: 8 * MB,
  video: 50 * MB,
  document: 15 * MB,
};

// Whole-post attachment budget.
export const MAX_TOTAL_BYTES = 75 * MB;

/* ---------- Format allowlist (plan §4.1) ---------- */
// Keyed by lower-case extension. `mimes` lists the browser-reported MIME values
// we accept for that extension. Extension is the primary gate; the MIME must
// fall in this set. Document types additionally tolerate empty/octet-stream
// MIME because some browsers/OSes report nothing useful for CSV/Office files.

const GENERIC_DOC_MIMES = ['', 'application/octet-stream'];

const ALLOWLIST = {
  // images
  jpg: { kind: 'image', mimes: ['image/jpeg'] },
  jpeg: { kind: 'image', mimes: ['image/jpeg'] },
  png: { kind: 'image', mimes: ['image/png'] },
  webp: { kind: 'image', mimes: ['image/webp'] },
  // video
  mp4: { kind: 'video', mimes: ['video/mp4'] },
  webm: { kind: 'video', mimes: ['video/webm'] },
  // documents (docx/xlsx are zip-based, so some environments report zip)
  pdf: { kind: 'document', mimes: ['application/pdf'] },
  docx: {
    kind: 'document',
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      ...GENERIC_DOC_MIMES,
    ],
  },
  xlsx: {
    kind: 'document',
    mimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      ...GENERIC_DOC_MIMES,
    ],
  },
  csv: {
    kind: 'document',
    mimes: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', ...GENERIC_DOC_MIMES],
  },
};

// Explicitly blocked, so the error can be specific rather than a generic
// "unsupported" (plan §4.1: HTML/SVG/ZIP/EXE/scripts banned).
const BLOCKED_EXTENSIONS = new Set(['html', 'htm', 'svg', 'zip', 'exe', 'js', 'sh', 'bat']);

/* ---------- Helpers ---------- */

export function extensionOf(name) {
  const dot = (name || '').lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function kindLabel(kind) {
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  return 'file';
}

/** 'image' | 'video' | 'document' for an allowed file, else null. */
export function kindForFile(file) {
  const entry = ALLOWLIST[extensionOf(file?.name)];
  return entry ? entry.kind : null;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  const digits = value >= 100 || exp === 0 ? 0 : value >= 10 ? 1 : 2;
  // parseFloat drops insignificant trailing zeros: 1.00 -> 1, 1.50 -> 1.5.
  return `${parseFloat(value.toFixed(digits))} ${units[exp]}`;
}

// The browser-reported MIME must be listed for the extension. An empty string is
// only accepted where the extension's set explicitly includes it.
function mimeMatches(ext, mime) {
  const entry = ALLOWLIST[ext];
  return entry ? entry.mimes.includes(mime || '') : false;
}

/* ---------- Validation (plan §8) ---------- */
// Validate newly-selected files against what's already staged. Returns
// { accepted: File[], errors: string[] }. `accepted` only contains files that
// pass every check AND fit the remaining count/size budget; each rejected file
// (or breached limit) yields one human-readable error naming the file and reason.

export function validateAttachments(existingFiles = [], newFiles = []) {
  const accepted = [];
  const errors = [];

  // Running tallies seeded from the already-staged files.
  let count = existingFiles.length;
  let images = existingFiles.filter((f) => kindForFile(f) === 'image').length;
  let videos = existingFiles.filter((f) => kindForFile(f) === 'video').length;
  let totalBytes = existingFiles.reduce((sum, f) => sum + (f.size || 0), 0);

  for (const file of newFiles) {
    const name = file?.name || 'file';
    const ext = extensionOf(name);
    const entry = ALLOWLIST[ext];

    if (!entry) {
      errors.push(
        BLOCKED_EXTENSIONS.has(ext)
          ? `"${name}": .${ext} files aren't allowed.`
          : `"${name}": unsupported file type. Allowed: JPEG/PNG/WebP, MP4/WebM, PDF/DOCX/XLSX/CSV.`,
      );
      continue;
    }
    if (!mimeMatches(ext, file.type)) {
      errors.push(`"${name}": file type (${file.type || 'unknown'}) doesn't match its .${ext} extension.`);
      continue;
    }
    if (!file.size) {
      errors.push(`"${name}": empty (0-byte) files can't be uploaded.`);
      continue;
    }

    const { kind } = entry;
    const perFileCap = MAX_BYTES_BY_KIND[kind];
    if (file.size > perFileCap) {
      errors.push(`"${name}": exceeds the ${kindLabel(kind)} size limit (${formatFileSize(perFileCap)}).`);
      continue;
    }
    // Per-kind count limits first, so their message wins over the generic
    // attachment-count limit when both would trip (e.g. an 11th image).
    if (kind === 'image' && images + 1 > MAX_IMAGES) {
      errors.push(`"${name}": a post can have at most ${MAX_IMAGES} images.`);
      continue;
    }
    if (kind === 'video' && videos + 1 > MAX_VIDEOS) {
      errors.push(`"${name}": a post can have at most ${MAX_VIDEOS} video.`);
      continue;
    }
    if (count + 1 > MAX_ATTACHMENTS) {
      errors.push(`"${name}": a post can have at most ${MAX_ATTACHMENTS} attachments.`);
      continue;
    }
    if (totalBytes + file.size > MAX_TOTAL_BYTES) {
      errors.push(`"${name}": adding this would exceed the ${formatFileSize(MAX_TOTAL_BYTES)} total attachment limit.`);
      continue;
    }

    accepted.push(file);
    count += 1;
    totalBytes += file.size;
    if (kind === 'image') images += 1;
    if (kind === 'video') videos += 1;
  }

  return { accepted, errors };
}
