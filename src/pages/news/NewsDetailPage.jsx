import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NewsCard from './NewsCard';
import NewsEmptyState from './NewsEmptyState';
import NewsImage from './NewsImage';
import NewsSkeleton from './NewsSkeleton';
import { getNewsArticleById, getRelatedNewsArticles } from '../../services/newsService';
import { formatCountryLabel, formatNewsDate, formatRelativeTime, formatSourceCount } from './newsUtils';
import './news.css';

const NewsDetailPage = () => {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceNotice, setSourceNotice] = useState('');

  const loadArticle = async (id) => {
    setLoading(true);
    setError('');
    setSourceNotice('');
    try {
      const nextArticle = await getNewsArticleById(id);
      setArticle(nextArticle);
      setRelatedArticles(nextArticle ? await getRelatedNewsArticles(nextArticle) : []);
    } catch {
      setError('News could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        setError('');
        setSourceNotice('');
        setArticle(null);
        setRelatedArticles([]);
        return getNewsArticleById(articleId);
      })
      .then(async (nextArticle) => {
        if (cancelled || nextArticle === null) return;
        const nextRelatedArticles = nextArticle ? await getRelatedNewsArticles(nextArticle) : [];
        if (!cancelled) {
          setArticle(nextArticle);
          setRelatedArticles(nextRelatedArticles);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('News could not be loaded right now.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const showUnavailableSource = () => {
    setSourceNotice('Original source is not available yet.');
  };

  return (
    <div className="news-page">
      <div className="news-page-inner">
        <nav className="news-breadcrumb" aria-label="Breadcrumb">
          <Link to="/news">News &amp; Insights</Link>
          <span>/</span>
          <span>{article?.title || 'Article'}</span>
        </nav>

        {loading ? <NewsSkeleton count={3} /> : null}

        {!loading && error ? (
          <div className="news-error-state" role="alert">
            <p>{error}</p>
            <button type="button" className="news-button news-button-secondary" onClick={() => loadArticle(articleId)}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && !article ? (
          <NewsEmptyState title="News article not found." actionLabel="Back to News" onAction={() => navigate('/news')} />
        ) : null}

        {!loading && !error && article ? (
          <>
            <article className="news-detail-card">
              <div className="news-detail-media">
                <NewsImage
                  src={article.imageUrl}
                  alt={`${article.title} image`}
                  beat={article.beat}
                  beatLabel={article.beatLabel}
                  lazy={false}
                />
                <span className="news-detail-media-beat">{article.beatLabel}</span>
              </div>
              <div className="news-detail-content">
                <div className="news-chip-row">
                  {article.territories.map((territory) => (
                    <span className="news-chip news-chip-territory" key={territory}>
                      {territory}
                    </span>
                  ))}
                  <span className="news-chip news-chip-country">{formatCountryLabel(article.country)}</span>
                </div>

                <h1>{article.title}</h1>

                <div className="news-card-meta">
                  <span>{formatNewsDate(article.publishedAt)}</span>
                  <span>{formatRelativeTime(article.publishedAt)}</span>
                </div>

                <p className="news-notice">
                  This displayed content is an AI-generated summary and not the original full article.
                </p>

                <div className="news-ai-label">AI-generated Summary</div>
                <div className="news-detail-summary">
                  {(article.body || '')
                    .split(/\n{2,}/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, index) => (
                      <p key={index}>{para}</p>
                    ))}
                </div>

                <div className="news-source-block">
                  <span className="news-source-badge">{formatSourceCount(article.sourceCount)}</span>
                  {article.sources.length ? (
                    <ul className="news-source-list">
                      {article.sources.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            className="news-text-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source.name}
                          </a>
                          {source.publishedAt ? (
                            <span className="news-source-date">{formatNewsDate(source.publishedAt)}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <button type="button" className="news-button news-button-secondary" onClick={showUnavailableSource}>
                      View Original Source
                    </button>
                  )}
                </div>

                <div className="news-tag-group" aria-label="SDG tags">
                  {article.sdg.map((tag) => (
                    <span className="news-tag news-tag-sdg" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>

                {sourceNotice ? (
                  <p className="news-notice" role="status">
                    {sourceNotice}
                  </p>
                ) : null}

                <div className="news-action-row">
                  <Link to="/news" className="news-button news-button-secondary">
                    Back to News
                  </Link>
                </div>
              </div>
            </article>

            {relatedArticles.length ? (
              <>
                <h2 className="news-section-title">Related Articles</h2>
                <div className="news-related-grid">
                  {relatedArticles.map((related) => (
                    <NewsCard article={related} key={related.id} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default NewsDetailPage;
