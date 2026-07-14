import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Icons, Modal } from '../../components/ui';
import { COLORS, FONT, RADII } from '../../theme';
import { TERRITORY_OPTIONS, TOPIC_OPTIONS } from '../../data/mockCommunityPosts';
import {
  addComment,
  createPost,
  deletePost,
  getPosts,
  toggleLikeComment,
  toggleLikePost,
} from '../../services/communityService';
import { requestPersistentStorage } from '../../services/communityAttachmentStore';
import { buildPostShareUrl, matchesCommunitySearch } from './communityUtils';
import CommunityFilters from './CommunityFilters';
import NewPostForm from './NewPostForm';
import PostCard from './PostCard';

const TOPIC_FILTER_OPTIONS = ['All Topics', ...TOPIC_OPTIONS];
const TERRITORY_FILTER_OPTIONS = ['All Regions', ...TERRITORY_OPTIONS.filter((t) => t !== 'All Borneo')];

const CommunityPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('All Topics');
  const [territory, setTerritory] = useState('All Regions');

  const [composerOpen, setComposerOpen] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingCommentPostId, setPendingCommentPostId] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const [searchParams] = useSearchParams();
  const highlightedPostId = searchParams.get('post');
  const highlightedRef = useRef(null);

  const refresh = useCallback(async () => {
    const nextPosts = await getPosts();
    setPosts(nextPosts);
    return nextPosts;
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Best-effort: ask the browser to keep our attachment storage from being
    // evicted under pressure. Never blocks; failure is fine (plan §2.3).
    requestPersistentStorage();

    getPosts()
      .then((nextPosts) => {
        if (!cancelled) setPosts(nextPosts);
      })
      .catch(() => {
        if (!cancelled) setError('Discussions could not be loaded right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Clear any pending toast timeout on unmount so it can't setState afterwards.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Land on a shared post: scroll it into view once it's actually on screen.
  useEffect(() => {
    if (!highlightedPostId || loading || !highlightedRef.current) return;
    highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedPostId, loading, posts]);

  const showToast = (message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  };

  const openComposer = () => {
    setSubmitError('');
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setSubmitError('');
  };

  const handleCreatePost = async (form) => {
    setSubmittingPost(true);
    setSubmitError('');
    try {
      await createPost(form);
      await refresh();
      closeComposer();
      showToast('Your discussion has been posted.');
    } catch (err) {
      // Keep the composer open with the user's input intact and explain why.
      setSubmitError(err?.message || 'Something went wrong while publishing. Please try again.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this discussion? This can’t be undone.')) return;
    try {
      await deletePost(postId);
      await refresh();
      showToast('Your discussion has been deleted.');
    } catch {
      showToast('Could not delete the discussion. Please try again.');
    }
  };

  const handleToggleLikePost = async (postId) => {
    await toggleLikePost(postId);
    await refresh();
  };

  const handleToggleLikeComment = async (postId, commentId) => {
    await toggleLikeComment(postId, commentId);
    await refresh();
  };

  const handleAddComment = async (postId, body) => {
    setPendingCommentPostId(postId);
    try {
      await addComment(postId, body);
      await refresh();
    } finally {
      setPendingCommentPostId(null);
    }
  };

  const handleShare = async (postId) => {
    const url = buildPostShareUrl(postId);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard.');
    } catch {
      showToast(url);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => (topic === 'All Topics' ? true : post.topic === topic))
      .filter((post) => (territory === 'All Regions' ? true : post.territory === territory))
      .filter((post) => matchesCommunitySearch(post, search));
  }, [posts, topic, territory, search]);

  const clearFilters = () => {
    setSearch('');
    setTopic('All Topics');
    setTerritory('All Regions');
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Community</h1>
          <p style={styles.subtitle}>
            Discuss what&rsquo;s happening across Borneo — wildlife, culture, livelihoods, and everyday
            life across Sabah, Sarawak, Brunei and Kalimantan.
          </p>
        </div>
        <Button variant="primary" onClick={openComposer}>
          <Icons.Plus size={18} style={{ marginRight: 6, verticalAlign: -3 }} />
          Start a discussion
        </Button>
      </header>

      <CommunityFilters
        search={search}
        onSearchChange={setSearch}
        topic={topic}
        onTopicChange={setTopic}
        territory={territory}
        onTerritoryChange={setTerritory}
        topicOptions={TOPIC_FILTER_OPTIONS}
        territoryOptions={TERRITORY_FILTER_OPTIONS}
        resultCount={filteredPosts.length}
      />

      {loading && <div style={styles.stateCard}>Loading discussions…</div>}

      {!loading && error && (
        <div style={{ ...styles.stateCard, color: COLORS.red }}>{error}</div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div style={styles.stateCard}>No discussions yet — be the first to start one.</div>
      )}

      {!loading && !error && posts.length > 0 && filteredPosts.length === 0 && (
        <div style={styles.stateCard}>
          <p style={{ margin: '0 0 12px' }}>No discussions match your search or filters.</p>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {!loading && !error && filteredPosts.length > 0 && (
        <div style={styles.list}>
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              id={`post-${post.id}`}
              ref={post.id === highlightedPostId ? highlightedRef : undefined}
              style={post.id === highlightedPostId ? styles.highlighted : undefined}
            >
              <PostCard
                post={post}
                onToggleLike={() => handleToggleLikePost(post.id)}
                onToggleLikeComment={(commentId) => handleToggleLikeComment(post.id, commentId)}
                onAddComment={(body) => handleAddComment(post.id, body)}
                onShare={() => handleShare(post.id)}
                onDelete={post.canDelete ? () => handleDeletePost(post.id) : undefined}
                isCommentPosting={pendingCommentPostId === post.id}
                defaultExpanded={post.id === highlightedPostId}
              />
            </div>
          ))}
        </div>
      )}

      <Modal open={composerOpen} onClose={closeComposer} width={560} disableClose={submittingPost}>
        <NewPostForm
          onSubmit={handleCreatePost}
          onCancel={closeComposer}
          submitting={submittingPost}
          submitError={submitError}
          onDirty={() => setSubmitError('')}
        />
      </Modal>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
};

const styles = {
  page: { padding: 28, maxWidth: 860, margin: '0 auto', fontFamily: FONT },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, margin: 0 },
  subtitle: { fontSize: 14.5, color: COLORS.muted, margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 },
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  stateCard: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.lg,
    padding: 28,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 14.5,
  },
  highlighted: { borderRadius: RADII.lg, boxShadow: `0 0 0 3px ${COLORS.amber}` },
  toast: {
    position: 'fixed',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    background: COLORS.ink,
    color: '#fff',
    padding: '10px 20px',
    borderRadius: RADII.pill,
    fontSize: 13.5,
    fontWeight: 600,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    zIndex: 1100,
  },
};

export default CommunityPage;
