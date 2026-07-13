// @vitest-environment node
//
// Runs in the `node` environment (not jsdom) so blobs round-trip with full
// fidelity: jsdom's Blob does not survive fake-indexeddb's structured clone,
// but Node 22's native Blob does. Real browsers store real Blobs, so this
// mirrors production behaviour more closely than jsdom here.
import { describe, it, expect } from 'vitest';
import {
  AttachmentStoreError,
  saveAttachment,
  getAttachment,
  deleteAttachment,
  deleteAttachments,
  listAttachmentRecords,
} from './communityAttachmentStore';

// fake-indexeddb is installed globally by src/test/setup.js. Each test uses
// unique storageKeys so cases stay isolated without a shared reset.

function blobOf(text, type = 'text/plain') {
  return new Blob([text], { type });
}

describe('communityAttachmentStore', () => {
  it('saves and reads back a blob', async () => {
    await saveAttachment({ storageKey: 'k-save-1', blob: blobOf('hello'), createdAt: '2026-07-13T00:00:00.000Z' });
    const blob = await getAttachment('k-save-1');
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe('hello');
  });

  it('returns null for a missing key', async () => {
    expect(await getAttachment('k-does-not-exist')).toBeNull();
  });

  it('deletes a single attachment', async () => {
    await saveAttachment({ storageKey: 'k-del-1', blob: blobOf('x') });
    await deleteAttachment('k-del-1');
    expect(await getAttachment('k-del-1')).toBeNull();
  });

  it('deleting a missing key resolves without error', async () => {
    await expect(deleteAttachment('k-never')).resolves.toBeUndefined();
  });

  it('bulk-deletes many attachments in one call', async () => {
    await saveAttachment({ storageKey: 'k-b1', blob: blobOf('1') });
    await saveAttachment({ storageKey: 'k-b2', blob: blobOf('2') });
    await saveAttachment({ storageKey: 'k-b3', blob: blobOf('3') });
    await deleteAttachments(['k-b1', 'k-b2']);
    expect(await getAttachment('k-b1')).toBeNull();
    expect(await getAttachment('k-b2')).toBeNull();
    expect(await getAttachment('k-b3')).not.toBeNull();
  });

  it('lists records as metadata without exposing blobs', async () => {
    await saveAttachment({ storageKey: 'k-list-1', blob: blobOf('a'), createdAt: '2026-01-01T00:00:00.000Z' });
    const records = await listAttachmentRecords();
    const record = records.find((r) => r.storageKey === 'k-list-1');
    expect(record).toBeDefined();
    expect(record.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(record).not.toHaveProperty('blob');
  });

  it('rejects a save with missing arguments', async () => {
    await expect(saveAttachment({ storageKey: '', blob: null })).rejects.toBeInstanceOf(AttachmentStoreError);
  });
});
