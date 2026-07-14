import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DraftCard from './DraftCard';
import {
  approveNews,
  getAllNews,
  getPendingDrafts,
  publishEditedNews,
  rejectNews,
  updateNews,
} from '../../../services/adminNewsService';
import { getSession, isAuthEnabled, onAuthChange, signOut } from '../../../services/authService';
import './adminNews.css';

const LOGIN_PATH = '/admin/login';
const LOGIN_STATE = { state: { from: '/admin/news' } };

const COUNTRY_FLAGS = {
  Malaysia: '🇲🇾',
  Brunei: '🇧🇳',
  Indonesia: '🇮🇩',
};

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReadOnlyCard = ({ article }) => (
  <article className="draft-card is-readonly">
    <span className={`draft-status-tag status-${article.status}`}>{article.status}</span>
    <h3 className="draft-readonly-title">{article.title}</h3>
    <p className="draft-readonly-body">{article.body}</p>
    <div className="draft-meta">
      {article.beatLabel ? (
        <span className="draft-meta-item">
          <strong>Beat:</strong> {article.beatLabel}
        </span>
      ) : null}
      {article.country ? (
        <span className="draft-meta-item">
          <strong>Country:</strong> {COUNTRY_FLAGS[article.country] || ''} {article.country}
        </span>
      ) : null}
      <span className="draft-meta-item">
        <strong>{article.status === 'published' ? 'Published' : 'Created'}:</strong>{' '}
        {formatDate(article.status === 'published' ? article.publishedAt : article.createdAt)}
      </span>
    </div>
  </article>
);

const NewsReview = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [drafts, setDrafts] = useState([]);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // When auth is disabled (mock mode) the gate is a no-op and we render at once.
  const [authChecked, setAuthChecked] = useState(!isAuthEnabled);
  const [adminEmail, setAdminEmail] = useState('');

  // Auth gate: require a session when Supabase is configured; redirect to the
  // login page if there is none, and again if the session is later cleared.
  useEffect(() => {
    if (!isAuthEnabled) return undefined;
    let active = true;

    getSession().then((session) => {
      if (!active) return;
      if (!session) {
        navigate(LOGIN_PATH, LOGIN_STATE);
        return;
      }
      setAdminEmail(session.user?.email || '');
      setAuthChecked(true);
    });

    const unsubscribe = onAuthChange((session) => {
      if (!active) return;
      if (!session) {
        navigate(LOGIN_PATH, LOGIN_STATE);
      } else {
        setAdminEmail(session.user?.email || '');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate(LOGIN_PATH, LOGIN_STATE);
  };

  const loadPending = () => {
    setLoading(true);
    setError('');
    return getPendingDrafts()
      .then((items) => setDrafts(items))
      .catch(() => setError('Drafts could not be loaded right now.'))
      .finally(() => setLoading(false));
  };

  const loadOthers = (status) => {
    setLoading(true);
    setError('');
    return getAllNews()
      .then((items) => setOthers(items.filter((item) => item.status === status)))
      .catch(() => setError('News could not be loaded right now.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authChecked) return undefined;
    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setError('');
        return tab === 'pending' ? getPendingDrafts() : getAllNews();
      })
      .then((items) => {
        if (cancelled || items === null) return;
        if (tab === 'pending') {
          setDrafts(items);
        } else {
          setOthers(items.filter((item) => item.status === tab));
        }
      })
      .catch(() => {
        if (!cancelled) setError('News could not be loaded right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, authChecked]);

  const handleRemove = (id) => {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const handleApprove = async (id) => {
    await approveNews(id);
    showNotice('Draft approved and published.');
  };

  const handlePublishEdited = async (id, edits) => {
    await publishEditedNews(id, edits);
    showNotice('Edited draft published.');
  };

  const handleReject = async (id) => {
    await rejectNews(id);
    showNotice('Draft rejected.');
  };

  const handleSaveEdits = async (id, edits) => {
    await updateNews(id, edits);
    showNotice('Edits saved. Draft stays in the queue.');
  };

  const handleRetry = () => {
    if (tab === 'pending') {
      loadPending();
    } else {
      loadOthers(tab);
    }
  };

  const renderBody = () => {
    if (loading) {
      return <div className="admin-news-state">Loading…</div>;
    }

    if (error) {
      return (
        <div className="admin-news-state is-error" role="alert">
          <p>{error}</p>
          <button type="button" className="admin-news-tab" onClick={handleRetry}>
            Retry
          </button>
        </div>
      );
    }

    if (tab === 'pending') {
      if (drafts.length === 0) {
        return <div className="admin-news-state admin-news-empty">No drafts awaiting review 🎉</div>;
      }
      return (
        <div className="admin-news-list">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onApprove={handleApprove}
              onPublishEdited={handlePublishEdited}
              onReject={handleReject}
              onSaveEdits={handleSaveEdits}
              onRemove={handleRemove}
            />
          ))}
        </div>
      );
    }

    if (others.length === 0) {
      return <div className="admin-news-state admin-news-empty">Nothing here yet.</div>;
    }
    return (
      <div className="admin-news-list">
        {others.map((article) => (
          <ReadOnlyCard key={article.id} article={article} />
        ))}
      </div>
    );
  };

  if (!authChecked) {
    return (
      <div className="admin-news-page">
        <div className="admin-news-inner">
          <div className="admin-news-state">Checking access…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-news-page">
      <div className="admin-news-inner">
        <header className="admin-news-header">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <h1 style={{ margin: 0 }}>News Review Queue</h1>
            {isAuthEnabled && adminEmail ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#4c5a52' }}>{adminEmail}</span>
                <button type="button" className="admin-news-tab" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>
          <p className="admin-news-subtitle" style={{ marginTop: '6px' }}>
            Admin approval view — review AI-generated drafts before they go public.
          </p>
        </header>

        <div className="admin-news-tabs" role="tablist" aria-label="News review filters">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`admin-news-tab${tab === item.key ? ' is-active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {notice ? (
          <div className="admin-news-state" role="status" style={{ marginBottom: '16px' }}>
            {notice}
          </div>
        ) : null}

        {renderBody()}
      </div>
    </div>
  );
};

export default NewsReview;
