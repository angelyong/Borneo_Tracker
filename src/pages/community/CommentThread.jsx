import { useState } from 'react';
import { Icons } from '../../components/ui';
import { COLORS, FONT, RADII } from '../../theme';
import { formatRelativeTime, initialOf } from './communityUtils';

// Renders one post's comments plus the add-comment field. Kept dumb (no
// service calls) — the parent owns data fetching and passes callbacks down,
// so this component only knows how to render and collect input.
const CommentThread = ({ comments, onAddComment, onToggleLikeComment, posting }) => {
  const [draft, setDraft] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAddComment(text);
    setDraft('');
  };

  return (
    <div style={styles.wrap}>
      {comments.length === 0 ? (
        <p style={styles.empty}>No comments yet — be the first to reply.</p>
      ) : (
        <ul style={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} style={styles.item}>
              <div style={styles.avatar}>{initialOf(comment.author)}</div>
              <div style={styles.body}>
                <div style={styles.metaRow}>
                  <span style={styles.author}>{comment.author}</span>
                  <span style={styles.time}>{formatRelativeTime(comment.createdAt)}</span>
                </div>
                <p style={styles.text}>{comment.body}</p>
                <button
                  type="button"
                  onClick={() => onToggleLikeComment(comment.id)}
                  style={styles.likeBtn}
                  aria-pressed={comment.likedByMe}
                  aria-label={comment.likedByMe ? 'Unlike comment' : 'Like comment'}
                >
                  <Icons.Heart size={14} filled={comment.likedByMe} color={comment.likedByMe ? COLORS.red : COLORS.muted} />
                  {comment.likeCount}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} style={styles.form}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment…"
          style={styles.input}
          disabled={posting}
        />
        <button type="submit" style={styles.submitBtn} disabled={posting || !draft.trim()}>
          Post
        </button>
      </form>
    </div>
  );
};

const styles = {
  wrap: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` },
  empty: { fontSize: 13.5, color: COLORS.muted, margin: '4px 0 12px' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  item: { display: 'flex', gap: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: COLORS.leaf,
    color: COLORS.forestDark,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    fontFamily: FONT,
  },
  body: { flex: 1, minWidth: 0 },
  metaRow: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  author: { fontSize: 13.5, fontWeight: 700, color: COLORS.ink, fontFamily: FONT },
  time: { fontSize: 12, color: COLORS.faint },
  text: { fontSize: 13.5, color: COLORS.ink, margin: '3px 0 6px', lineHeight: 1.5, fontFamily: FONT },
  likeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: 'none',
    background: 'transparent',
    color: COLORS.muted,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: FONT,
  },
  form: { display: 'flex', gap: 8, marginTop: 14 },
  input: {
    flex: 1,
    padding: '9px 12px',
    borderRadius: RADII.pill,
    border: `1px solid ${COLORS.border}`,
    fontSize: 13.5,
    fontFamily: FONT,
    outline: 'none',
  },
  submitBtn: {
    padding: '9px 18px',
    borderRadius: RADII.pill,
    border: 'none',
    background: COLORS.forest,
    color: '#fff',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: FONT,
  },
};

export default CommentThread;
