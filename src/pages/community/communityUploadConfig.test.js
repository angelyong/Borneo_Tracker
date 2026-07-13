import { describe, it, expect } from 'vitest';
import {
  MAX_ATTACHMENTS,
  MAX_IMAGES,
  MAX_VIDEOS,
  MAX_TOTAL_BYTES,
  kindForFile,
  formatFileSize,
  validateAttachments,
} from './communityUploadConfig';

const MB = 1024 * 1024;

// Build a File whose `.size` equals `bytes` and whose reported MIME is `type`.
function fileOf(name, type, bytes = 1024) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('kindForFile', () => {
  it('classifies by extension', () => {
    expect(kindForFile(fileOf('a.jpg', 'image/jpeg'))).toBe('image');
    expect(kindForFile(fileOf('a.png', 'image/png'))).toBe('image');
    expect(kindForFile(fileOf('a.webp', 'image/webp'))).toBe('image');
    expect(kindForFile(fileOf('a.mp4', 'video/mp4'))).toBe('video');
    expect(kindForFile(fileOf('a.webm', 'video/webm'))).toBe('video');
    expect(kindForFile(fileOf('a.pdf', 'application/pdf'))).toBe('document');
    expect(kindForFile(fileOf('a.csv', 'text/csv'))).toBe('document');
  });

  it('returns null for unknown / blocked types', () => {
    expect(kindForFile(fileOf('a.exe', 'application/octet-stream'))).toBeNull();
    expect(kindForFile(fileOf('a.svg', 'image/svg+xml'))).toBeNull();
    expect(kindForFile(fileOf('noext', ''))).toBeNull();
  });
});

describe('validateAttachments — format allowlist', () => {
  it('accepts allowed image/video/document types', () => {
    const { accepted, errors } = validateAttachments([], [
      fileOf('photo.jpg', 'image/jpeg'),
      fileOf('clip.mp4', 'video/mp4'),
      fileOf('report.pdf', 'application/pdf'),
    ]);
    expect(accepted).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });

  it('rejects blocked extensions with a specific message', () => {
    const { accepted, errors } = validateAttachments([], [fileOf('x.exe', 'application/octet-stream')]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(/\.exe files aren't allowed/);
  });

  it('rejects unknown extensions', () => {
    const { accepted, errors } = validateAttachments([], [fileOf('x.gif', 'image/gif')]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(/unsupported file type/i);
  });

  it('rejects when MIME does not match the extension', () => {
    const { accepted, errors } = validateAttachments([], [fileOf('fake.png', 'application/pdf')]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(/doesn't match/);
  });

  it('tolerates empty/generic MIME for CSV and Office files', () => {
    const { accepted, errors } = validateAttachments([], [
      fileOf('data.csv', ''),
      fileOf('sheet.xlsx', 'application/octet-stream'),
      fileOf('doc.docx', 'application/zip'),
    ]);
    expect(accepted).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });
});

describe('validateAttachments — size & count limits', () => {
  it('rejects 0-byte files', () => {
    const { accepted, errors } = validateAttachments([], [fileOf('empty.pdf', 'application/pdf', 0)]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(/0-byte/);
  });

  it('enforces the per-image size cap (8 MB)', () => {
    const ok = validateAttachments([], [fileOf('ok.jpg', 'image/jpeg', 8 * MB)]);
    expect(ok.accepted).toHaveLength(1);
    const tooBig = validateAttachments([], [fileOf('big.jpg', 'image/jpeg', 8 * MB + 1)]);
    expect(tooBig.accepted).toHaveLength(0);
    expect(tooBig.errors[0]).toMatch(/image size limit/);
  });

  it('enforces the per-video size cap (50 MB)', () => {
    const tooBig = validateAttachments([], [fileOf('big.mp4', 'video/mp4', 50 * MB + 1)]);
    expect(tooBig.accepted).toHaveLength(0);
    expect(tooBig.errors[0]).toMatch(/video size limit/);
  });

  it('enforces the per-document size cap (15 MB)', () => {
    const tooBig = validateAttachments([], [fileOf('big.pdf', 'application/pdf', 15 * MB + 1)]);
    expect(tooBig.accepted).toHaveLength(0);
    expect(tooBig.errors[0]).toMatch(/file size limit/);
  });

  it('enforces the total attachment budget (75 MB)', () => {
    // 50 MB video + 15 MB doc already staged (65 MB); another 15 MB doc → 80 MB.
    // Each file is within its own per-file cap, so only the total budget trips.
    const existing = [fileOf('v.mp4', 'video/mp4', 50 * MB), fileOf('a.pdf', 'application/pdf', 15 * MB)];
    const { accepted, errors } = validateAttachments(existing, [fileOf('b.pdf', 'application/pdf', 15 * MB)]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(/total attachment limit/);
  });

  it('enforces the max attachment count', () => {
    const existing = Array.from({ length: MAX_ATTACHMENTS }, (_, i) => fileOf(`f${i}.pdf`, 'application/pdf'));
    const { accepted, errors } = validateAttachments(existing, [fileOf('one-more.pdf', 'application/pdf')]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(new RegExp(`at most ${MAX_ATTACHMENTS} attachments`));
  });

  it('enforces at most one video', () => {
    const existing = [fileOf('a.mp4', 'video/mp4')];
    const { accepted, errors } = validateAttachments(existing, [fileOf('b.webm', 'video/webm')]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(new RegExp(`at most ${MAX_VIDEOS} video`));
  });

  it('enforces the max image count independently of other kinds', () => {
    const existing = Array.from({ length: MAX_IMAGES }, (_, i) => fileOf(`img${i}.png`, 'image/png'));
    const { accepted, errors } = validateAttachments(existing, [fileOf('extra.png', 'image/png')]);
    expect(accepted).toHaveLength(0);
    expect(errors[0]).toMatch(new RegExp(`at most ${MAX_IMAGES} images`));
  });

  it('accepts the valid files in a batch and rejects only the bad ones', () => {
    const { accepted, errors } = validateAttachments([], [
      fileOf('good.jpg', 'image/jpeg'),
      fileOf('bad.exe', 'application/octet-stream'),
      fileOf('also-good.pdf', 'application/pdf'),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['good.jpg', 'also-good.pdf']);
    expect(errors).toHaveLength(1);
  });
});

describe('formatFileSize', () => {
  it('formats bytes across units', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1.5 * MB)).toBe('1.5 MB');
    expect(formatFileSize(MAX_TOTAL_BYTES)).toBe('75 MB');
  });

  it('handles invalid input gracefully', () => {
    expect(formatFileSize(NaN)).toBe('—');
    expect(formatFileSize(-5)).toBe('—');
  });
});
