import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useAuth } from '../../../auth/useAuth';
import './adminNews.css';

// The route is gated by <RequireAdmin> (session + profile.role === 'admin'), so
// this page can assume an authenticated admin and just does the queue work.

const COUNTRY_FLAGS = {
  Malaysia: '🇲🇾',
  Brunei: '🇧🇳',
  Indonesia: '🇮🇩',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReadOnlyCard = ({ article, t }) => (
  <article className="draft-card is-readonly">
    <span className={`draft-status-tag status-${article.status}`}>
      {article.status === 'published' ? t('admin.tabPublished') : t('admin.tabRejected')}
    </span>
    <h3 className="draft-readonly-title">{article.title}</h3>
    <p className="draft-readonly-body">{article.body}</p>
    <div className="draft-meta">
      {article.beatLabel ? (
        <span className="draft-meta-item">
          <strong>{t('admin.beatLabel')}</strong> {article.beatLabel}
        </span>
      ) : null}
      {article.country ? (
        <span className="draft-meta-item">
          <strong>{t('admin.countryLabel')}</strong> {COUNTRY_FLAGS[article.country] || ''} {article.country}
        </span>
      ) : null}
      <span className="draft-meta-item">
        <strong>{article.status === 'published' ? t('admin.publishedLabel') : t('admin.createdLabel')}</strong>{' '}
        {formatDate(article.status === 'published' ? article.publishedAt : article.createdAt)}
      </span>
    </div>
  </article>
);

const NewsReview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthEnabled, signOut } = useAuth();
  const adminEmail = user?.email || '';
  const TABS = [
    { key: 'pending', label: t('admin.tabPending') },
    { key: 'published', label: t('admin.tabPublished') },
    { key: 'rejected', label: t('admin.tabRejected') },
  ];
  const [tab, setTab] = useState('pending');
  const [drafts, setDrafts] = useState([]);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const loadPending = () => {
    setLoading(true);
    setError('');
    return getPendingDrafts()
      .then((items) => setDrafts(items))
      .catch(() => setError(t('admin.draftsLoadError')))
      .finally(() => setLoading(false));
  };

  const loadOthers = (status) => {
    setLoading(true);
    setError('');
    return getAllNews()
      .then((items) => setOthers(items.filter((item) => item.status === status)))
      .catch(() => setError(t('news.loadError')))
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
        if (!cancelled) setError(t('news.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Re-runs on tab change only — a language switch mid-view just won't
    // retranslate an already-shown error until the tab is retried.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    showNotice(t('admin.draftApprovedPublished'));
  };

  const handlePublishEdited = async (id, edits) => {
    await publishEditedNews(id, edits);
    showNotice(t('admin.editedDraftPublished'));
  };

  const handleReject = async (id) => {
    await rejectNews(id);
    showNotice(t('admin.draftRejected'));
  };

  const handleSaveEdits = async (id, edits) => {
    await updateNews(id, edits);
    showNotice(t('admin.editsSavedQueue'));
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
      return <div className="admin-news-state">{t('common.loading')}</div>;
    }

    if (error) {
      return (
        <div className="admin-news-state is-error" role="alert">
          <p>{error}</p>
          <button type="button" className="admin-news-tab" onClick={handleRetry}>
            {t('common.retry')}
          </button>
        </div>
      );
    }

    if (tab === 'pending') {
      if (drafts.length === 0) {
        return <div className="admin-news-state admin-news-empty">{t('admin.noDraftsAwaitingReview')}</div>;
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
      return <div className="admin-news-state admin-news-empty">{t('admin.nothingHereYet')}</div>;
    }
    return (
      <div className="admin-news-list">
        {others.map((article) => (
          <ReadOnlyCard key={article.id} article={article} t={t} />
        ))}
      </div>
    );
  };

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
            <h1 style={{ margin: 0 }}>{t('admin.newsReviewQueue')}</h1>
            {isAuthEnabled && adminEmail ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>{adminEmail}</span>
                <button type="button" className="admin-news-tab" onClick={handleLogout}>
                  {t('sidebar.logOut')}
                </button>
              </div>
            ) : null}
          </div>
          <p className="admin-news-subtitle" style={{ marginTop: '6px' }}>
            {t('admin.approvalSubtitle')}
          </p>
        </header>

        <div className="admin-news-tabs" role="tablist" aria-label={t('admin.newsReviewFiltersAria')}>
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
