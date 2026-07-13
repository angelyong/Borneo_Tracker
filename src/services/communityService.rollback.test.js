import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the attachment store so we can inject save/delete failures at will.
vi.mock('./communityAttachmentStore', () => ({
  saveAttachment: vi.fn(),
  deleteAttachments: vi.fn(),
}));

import { saveAttachment, deleteAttachments } from './communityAttachmentStore';
import { createPost, deletePost, getPosts, addComment } from './communityService';

function fileOf(name, type) {
  return new File([new Uint8Array(64)], name, { type });
}

const userPosts = (posts) => posts.filter((p) => p.canDelete);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  saveAttachment.mockReset();
  deleteAttachments.mockReset();
  saveAttachment.mockResolvedValue(undefined);
  deleteAttachments.mockResolvedValue(undefined);
});

describe('createPost rollback', () => {
  it('rolls back earlier blobs when a later attachment save fails', async () => {
    saveAttachment.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk full'));

    await expect(
      createPost({
        title: 't',
        body: 'b',
        topic: 'General',
        territory: 'Sabah',
        attachments: [fileOf('a.jpg', 'image/jpeg'), fileOf('b.jpg', 'image/jpeg')],
      }),
    ).rejects.toThrow('disk full');

    // Exactly the one already-saved blob is rolled back.
    expect(deleteAttachments).toHaveBeenCalledTimes(1);
    expect(deleteAttachments.mock.calls[0][0]).toHaveLength(1);
    // No post was persisted.
    expect(userPosts(await getPosts())).toHaveLength(0);
  });

  it('rolls back all blobs when the metadata (localStorage) write fails', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    await expect(
      createPost({
        title: 't',
        body: 'b',
        topic: 'General',
        territory: 'Sabah',
        attachments: [fileOf('a.jpg', 'image/jpeg'), fileOf('b.pdf', 'application/pdf')],
      }),
    ).rejects.toThrow('quota');

    expect(deleteAttachments).toHaveBeenCalledTimes(1);
    expect(deleteAttachments.mock.calls[0][0]).toHaveLength(2);

    setItem.mockRestore();
    expect(userPosts(await getPosts())).toHaveLength(0);
  });

  it('does not clobber a comment written to the overlay during upload', async () => {
    // Simulate a concurrent comment landing while the blob is being saved.
    saveAttachment.mockImplementation(async () => {
      await addComment('seed-1', 'written-during-upload');
    });

    await createPost({
      title: 'racy',
      body: 'b',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('a.jpg', 'image/jpeg')],
    });

    const posts = await getPosts();
    const seed = posts.find((p) => p.id === 'seed-1');
    expect(seed.comments.map((c) => c.body)).toContain('written-during-upload');
    // ...and the new post is there too.
    expect(posts.some((p) => p.canDelete && p.title === 'racy')).toBe(true);
  });
});

describe('deletePost resilience', () => {
  it('still deletes the post even if blob cleanup rejects', async () => {
    const created = await createPost({
      title: 't',
      body: 'b',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('a.jpg', 'image/jpeg')],
    });

    deleteAttachments.mockRejectedValueOnce(new Error('io error'));

    await expect(deletePost(created.id)).resolves.toBeUndefined();
    expect((await getPosts()).find((p) => p.id === created.id)).toBeUndefined();
  });
});
