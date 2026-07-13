import { describe, it, expect, beforeEach } from 'vitest';
import { CURRENT_USER, getPosts, createPost, deletePost, toggleLikePost, addComment } from './communityService';
import { getAttachment } from './communityAttachmentStore';

const STORAGE_KEY = 'borneo-tracker:community:v1';

function fileOf(name, type, bytes = 64) {
  return new File([new Uint8Array(bytes)], name, { type });
}

beforeEach(() => localStorage.clear());

describe('createPost', () => {
  it('creates a text-only post: shown first, deletable, empty attachments', async () => {
    const created = await createPost({ title: 'Hi', body: 'Body', topic: 'General', territory: 'Sabah' });
    expect(created.author).toBe(CURRENT_USER);
    expect(created.canDelete).toBe(true);
    expect(created.attachments).toEqual([]);

    const posts = await getPosts();
    expect(posts[0].id).toBe(created.id);
  });

  it('saves serialisable attachment metadata and persists each blob', async () => {
    const created = await createPost({
      title: 'With files',
      body: 'b',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('a.jpg', 'image/jpeg'), fileOf('b.pdf', 'application/pdf')],
    });

    expect(created.attachments).toHaveLength(2);
    expect(created.attachments[0]).toMatchObject({ kind: 'image', name: 'a.jpg', mimeType: 'image/jpeg' });
    // Metadata must not carry the raw blob or an object URL.
    expect(created.attachments[0]).not.toHaveProperty('blob');
    expect(JSON.stringify(created.attachments)).not.toMatch(/blob:/);

    for (const attachment of created.attachments) {
      expect(await getAttachment(attachment.storageKey)).not.toBeNull();
    }
  });
});

describe('deletePost', () => {
  it('removes a user post and cleans up its blobs', async () => {
    const created = await createPost({
      title: 't',
      body: 'b',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('a.jpg', 'image/jpeg')],
    });
    const key = created.attachments[0].storageKey;

    await deletePost(created.id);

    const posts = await getPosts();
    expect(posts.find((p) => p.id === created.id)).toBeUndefined();
    expect(await getAttachment(key)).toBeNull();
  });

  it('refuses to delete a read-only seed post', async () => {
    const seed = (await getPosts()).find((p) => !p.canDelete);
    await expect(deletePost(seed.id)).rejects.toThrow();
    expect((await getPosts()).find((p) => p.id === seed.id)).toBeDefined();
  });
});

describe('backward compatibility & isolation', () => {
  it('normalizes old overlay posts that have no attachments field', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        posts: [
          {
            id: 'post-old',
            author: 'You',
            title: 'Old',
            body: 'x',
            topic: 'General',
            territory: 'Sabah',
            createdAt: '2026-01-01T00:00:00.000Z',
            likeCount: 0,
            comments: [],
          },
        ],
        postLikes: {},
        comments: {},
        commentLikes: {},
      }),
    );

    const old = (await getPosts()).find((p) => p.id === 'post-old');
    expect(old.attachments).toEqual([]);
    expect(old.canDelete).toBe(true);
  });

  it('likes and comments still work and leave attachments intact', async () => {
    const created = await createPost({
      title: 't',
      body: 'b',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('a.jpg', 'image/jpeg')],
    });

    await toggleLikePost(created.id);
    await addComment(created.id, 'nice');

    const p = (await getPosts()).find((x) => x.id === created.id);
    expect(p.likeCount).toBe(1);
    expect(p.likedByMe).toBe(true);
    expect(p.comments.map((c) => c.body)).toContain('nice');
    expect(p.attachments).toHaveLength(1);
  });
});
