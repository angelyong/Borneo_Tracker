import { useEffect, useState } from 'react';
import { COLORS, FONT, RADII } from '../../theme';
import { Icons } from '../../components/ui';
import { getAttachment } from '../../services/communityAttachmentStore';
import { extensionOf, formatFileSize } from './communityUploadConfig';

// Never trust the stored name for path behaviour: drop any directory part and
// replace path separators, control chars and reserved characters (plan §7.7).
function safeDownloadName(name) {
  const base = (name || 'download').split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f<>:"|?*]/g, '_').trim();
  return cleaned || 'download';
}

// Renders a post's attachments: image gallery, inline video players and
// downloadable document cards. Blobs are read from IndexedDB; a single missing
// or unreadable attachment degrades to a fallback without breaking the post.
const PostAttachments = ({ postTitle, attachments = [] }) => {
  // id -> { status: 'loading' | 'ready' | 'missing', url?, blob? }
  const [loaded, setLoaded] = useState({});

  // getPosts() returns a fresh array on every feed refresh, so `attachments`
  // changes identity on every like/comment even though its contents are stable.
  // Key the loader on the storage keys instead, so it only re-runs when the set
  // of attachments actually changes — otherwise the cleanup would revoke object
  // URLs the <img>/<video> are still displaying, flashing broken media.
  const attachmentsKey = attachments.map((a) => a.storageKey).join('|');

  useEffect(() => {
    let cancelled = false;
    const urls = [];

    async function load() {
      const entries = await Promise.all(
        attachments.map(async (att) => {
          try {
            const blob = await getAttachment(att.storageKey);
            if (!blob) return [att.id, { status: 'missing' }];
            const needsUrl = att.kind === 'image' || att.kind === 'video';
            const url = needsUrl ? URL.createObjectURL(blob) : null;
            if (url) urls.push(url);
            return [att.id, { status: 'ready', url, blob }];
          } catch {
            return [att.id, { status: 'missing' }];
          }
        }),
      );
      if (cancelled) {
        urls.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setLoaded(Object.fromEntries(entries));
    }

    load();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentsKey]);

  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.kind === 'image');
  const videos = attachments.filter((a) => a.kind === 'video');
  const documents = attachments.filter((a) => a.kind === 'document');

  const download = (att) => {
    const state = loaded[att.id];
    if (state?.status !== 'ready' || !state.blob) return;
    const url = URL.createObjectURL(state.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeDownloadName(att.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoke after a delay, not synchronously: revoking immediately after
    // click() can cancel the download before the browser reads the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div style={styles.wrap}>
      {images.length > 0 && (
        <div style={styles.gallery}>
          {images.map((att, i) => {
            const state = loaded[att.id];
            if (state?.status === 'missing') return <Fallback key={att.id} tile />;
            return (
              <div key={att.id} style={styles.imageTile}>
                {state?.status === 'ready' ? (
                  <img src={state.url} alt={`${postTitle} — image ${i + 1}`} style={styles.image} />
                ) : (
                  <div style={styles.placeholder} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {videos.map((att) => {
        const state = loaded[att.id];
        if (state?.status === 'missing') return <Fallback key={att.id} />;
        return state?.status === 'ready' ? (
          <video key={att.id} src={state.url} controls preload="metadata" style={styles.video} />
        ) : (
          <div key={att.id} style={{ ...styles.video, ...styles.placeholder, height: 180 }} />
        );
      })}

      {documents.map((att) => {
        const state = loaded[att.id];
        if (state?.status === 'missing') return <Fallback key={att.id} />;
        return (
          <div key={att.id} style={styles.docCard}>
            <div style={styles.docIcon}>
              <Icons.FileArrow size={20} color={COLORS.muted} />
            </div>
            <div style={styles.docMeta}>
              <div style={styles.docName} title={att.name}>
                {att.name}
              </div>
              <div style={styles.docSub}>
                {extensionOf(att.name).toUpperCase()} · {formatFileSize(att.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => download(att)}
              disabled={state?.status !== 'ready'}
              aria-label={`Download ${att.name}`}
              style={styles.downloadBtn}
            >
              <Icons.Download size={16} color={COLORS.navy} />
              Download
            </button>
          </div>
        );
      })}
    </div>
  );
};

const Fallback = ({ tile }) => (
  <div style={{ ...styles.fallback, ...(tile ? styles.fallbackTile : {}) }}>
    <Icons.Warn size={15} color={COLORS.muted} style={{ flexShrink: 0 }} />
    <span>Attachment unavailable</span>
  </div>
);

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 },
  gallery: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  imageTile: { borderRadius: RADII.md, overflow: 'hidden', background: COLORS.greySoft },
  image: { width: '100%', height: 130, objectFit: 'cover', display: 'block' },
  placeholder: { width: '100%', height: 130, background: COLORS.greySoft },
  video: { width: '100%', maxHeight: 360, borderRadius: RADII.md, background: '#000', display: 'block' },
  docCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.md,
    background: '#fff',
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: RADII.sm,
    background: COLORS.greySoft,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docMeta: { flex: 1, minWidth: 0 },
  docName: {
    fontSize: 13.5,
    fontWeight: 600,
    color: COLORS.ink,
    fontFamily: FONT,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  docSub: { fontSize: 12, color: COLORS.muted, fontFamily: FONT, marginTop: 2 },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: FONT,
    padding: '8px 14px',
    borderRadius: RADII.pill,
    cursor: 'pointer',
    flexShrink: 0,
  },
  fallback: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    border: `1px dashed ${COLORS.border}`,
    borderRadius: RADII.md,
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: FONT,
    background: '#FAFAF7',
  },
  fallbackTile: { justifyContent: 'center', height: 130, padding: 0 },
};

export default PostAttachments;
