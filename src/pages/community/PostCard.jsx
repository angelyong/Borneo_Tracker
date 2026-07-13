import { useState } from 'react';
import { Card, Icons } from '../../components/ui';
import { COLORS, FONT, RADII } from '../../theme';
import { formatRelativeTime, initialOf, truncateText } from './communityUtils';
import CommentThread from './CommentThread';
import PostAttachments from './PostAttachments';

const BODY_PREVIEW_LENGTH = 220;

const PostCard = ({
  post,
  onToggleLike,
  onToggleLikeComment,
  onAddComment,
  onShare,
  onDelete,
  isCommentPosting,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showFullBody, setShowFullBody] = useState(false);

  const isLong = post.body.length > BODY_PREVIEW_LENGTH;
  const displayBody = showFullBody || !isLong ? post.body : truncateText(post.body, BODY_PREVIEW_LENGTH);

  return (
    <Card style={styles.card}>
      <div style={styles.header}>
        <div style={styles.avatar}>{initialOf(post.author)}</div>
        <div style={styles.headerText}>
          <div style={styles.metaRow}>
            <span style={styles.author}>{post.author}</span>
            <span style={styles.dot}>·</span>
            <span style={styles.time}>{formatRelativeTime(post.createdAt)}</span>
          </div>
          <div style={styles.badgeRow}>
            <span style={styles.territoryBadge}>{post.territory}</span>
            <span style={styles.topicBadge}>{post.topic}</span>
          </div>
        </div>
      </div>

      <h3 style={styles.title}>{post.title}</h3>
      <p style={styles.body}>
        {displayBody}
        {isLong && (
          <button type="button" onClick={() => setShowFullBody((v) => !v)} style={styles.readMoreBtn}>
            {showFullBody ? ' Show less' : ' Read more'}
          </button>
        )}
      </p>

      <PostAttachments postTitle={post.title} attachments={post.attachments} />

      <div style={styles.actionRow}>
        <button
          type="button"
          onClick={onToggleLike}
          style={styles.actionBtn}
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? 'Unlike post' : 'Like post'}
        >
          <Icons.Heart size={18} filled={post.likedByMe} color={post.likedByMe ? COLORS.red : COLORS.muted} />
          <span style={post.likedByMe ? { color: COLORS.red } : undefined}>{post.likeCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={styles.actionBtn}
          aria-expanded={expanded}
        >
          <Icons.Comment size={18} color={COLORS.muted} />
          {post.commentCount}
        </button>

        <button type="button" onClick={onShare} style={styles.actionBtn}>
          <Icons.Share size={18} color={COLORS.muted} />
          Share
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={styles.deleteBtn}
            aria-label={`Delete discussion: ${post.title}`}
          >
            <Icons.Trash size={18} color={COLORS.red} />
            Delete
          </button>
        )}
      </div>

      {expanded && (
        <CommentThread
          comments={post.comments}
          onAddComment={onAddComment}
          onToggleLikeComment={onToggleLikeComment}
          posting={isCommentPosting}
        />
      )}
    </Card>
  );
};

const styles = {
  card: { padding: '18px 20px' },
  header: { display: 'flex', gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: COLORS.forest,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
    fontFamily: FONT,
  },
  headerText: { flex: 1, minWidth: 0 },
  metaRow: { display: 'flex', alignItems: 'baseline', gap: 6 },
  author: { fontSize: 14.5, fontWeight: 700, color: COLORS.ink, fontFamily: FONT },
  dot: { color: COLORS.faint },
  time: { fontSize: 13, color: COLORS.muted },
  badgeRow: { display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  territoryBadge: {
    fontSize: 11.5,
    fontWeight: 700,
    padding: '2px 9px',
    borderRadius: RADII.pill,
    background: COLORS.blueSoft,
    color: COLORS.blue,
  },
  topicBadge: {
    fontSize: 11.5,
    fontWeight: 700,
    padding: '2px 9px',
    borderRadius: RADII.pill,
    background: COLORS.greenSoft,
    color: COLORS.green,
  },
  title: { fontSize: 17, fontWeight: 800, color: COLORS.ink, margin: '12px 0 6px', fontFamily: FONT },
  body: { fontSize: 14.5, color: COLORS.ink, lineHeight: 1.55, margin: 0, fontFamily: FONT },
  readMoreBtn: {
    border: 'none',
    background: 'transparent',
    color: COLORS.navy,
    fontWeight: 700,
    fontSize: 14.5,
    cursor: 'pointer',
    padding: 0,
    fontFamily: FONT,
  },
  actionRow: {
    display: 'flex',
    gap: 22,
    marginTop: 14,
    paddingTop: 12,
    borderTop: `1px solid ${COLORS.border}`,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    background: 'transparent',
    color: COLORS.muted,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontFamily: FONT,
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    border: 'none',
    background: 'transparent',
    color: COLORS.red,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontFamily: FONT,
  },
};

export default PostCard;
