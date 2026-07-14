import { useEffect, useState } from 'react';
import DraftCard from './DraftCard';
import {
  approveNews,
  getAllNews,
  getPendingDrafts,
  publishEditedNews,
  rejectNews,
  updateNews,
} from '../../../services/adminNewsService';
import './adminNews.css';

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
  const [tab, setTab] = useState('pending');
  const [drafts, setDrafts] = useState([]);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
  }, [tab]);

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

  return (
    <div className="admin-news-page">
      <div className="admin-news-inner">
        <header className="admin-news-header">
          <h1>News Review Queue</h1>
          <p className="admin-news-subtitle">
            Admin approval view — review AI-generated drafts before they go public. Access is limited to signed-in admins.
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
