import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FeaturedNews from './FeaturedNews';
import NewsCard from './NewsCard';
import NewsEmptyState from './NewsEmptyState';
import NewsFilters from './NewsFilters';
import NewsSkeleton from './NewsSkeleton';
import { getNewsArticles } from '../../services/newsService';
import { markSeen } from '../../utils/notifications';
import { matchesNewsSearch } from './newsUtils';
import './news.css';

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_COUNT = 6;
const ALL_TERRITORIES = 'All Territories';
const ALL_COUNTRIES = 'All Countries';
const ALL_TOPICS = 'All Topics';

const NewsPage = () => {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [territory, setTerritory] = useState(ALL_TERRITORIES);
  const [country, setCountry] = useState(ALL_COUNTRIES);
  const [topic, setTopic] = useState(ALL_TOPICS);
  const [sort, setSort] = useState('latest');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [sourceNotice, setSourceNotice] = useState('');

  const handleRetry = async () => {
    setLoading(true);
    setError('');
    try {
      const nextArticles = await getNewsArticles();
      setArticles(nextArticles);
    } catch {
      setError(t('news.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Clears this page's sidebar badge — the whole point of opening it.
    markSeen('news');

    getNewsArticles()
      .then((nextArticles) => {
        if (!cancelled) {
          setArticles(nextArticles);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('news.loadError'));
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
    // Mount-only fetch — re-running on every language switch would refetch
    // needlessly; an already-shown error just won't retranslate until retried.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetVisibleCount = () => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    resetVisibleCount();
  };

  const handleTerritoryChange = (value) => {
    setTerritory(value);
    resetVisibleCount();
  };

  const handleCountryChange = (value) => {
    setCountry(value);
    resetVisibleCount();
  };

  const handleTopicChange = (value) => {
    setTopic(value);
    resetVisibleCount();
  };

  const handleSortChange = (value) => {
    setSort(value);
    resetVisibleCount();
  };

  const topics = useMemo(() => {
    const uniqueTopics = [...new Set(articles.map((article) => article.beatLabel))].sort();
    return [ALL_TOPICS, ...uniqueTopics];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles
      .filter((article) => (territory === ALL_TERRITORIES ? true : article.territories?.includes(territory)))
      .filter((article) => (country === ALL_COUNTRIES ? true : article.country === country))
      .filter((article) => (topic === ALL_TOPICS ? true : article.beatLabel === topic))
      .filter((article) => matchesNewsSearch(article, search))
      .sort((a, b) => {
        const first = new Date(a.publishedAt).getTime();
        const second = new Date(b.publishedAt).getTime();
        return sort === 'latest' ? second - first : first - second;
      });
  }, [articles, country, search, sort, territory, topic]);

  const displayedFeaturedArticle = filteredArticles.find((article) => article.isFeatured) || filteredArticles[0];
  const latestArticles = filteredArticles.filter((article) => article.id !== displayedFeaturedArticle?.id);
  const visibleArticles = latestArticles.slice(0, visibleCount);
  const hasFilters =
    search ||
    territory !== ALL_TERRITORIES ||
    country !== ALL_COUNTRIES ||
    topic !== ALL_TOPICS;
  const hasMore = visibleCount < latestArticles.length;

  const clearFilters = () => {
    setSearch('');
    setTerritory(ALL_TERRITORIES);
    setCountry(ALL_COUNTRIES);
    setTopic(ALL_TOPICS);
    setSort('latest');
  };

  const showUnavailableSource = () => {
    setSourceNotice(t('news.sourceUnavailable'));
  };

  return (
    <div className="news-page">
      <div className="news-page-inner">
        <header className="news-header">
          <div>
            <h1>{t('sidebar.newsInsights')}</h1>
            <p>{t('news.subtitle')}</p>
          </div>
        </header>

        <NewsFilters
          search={search}
          territory={territory}
          country={country}
          topic={topic}
          sort={sort}
          topics={topics}
          resultCount={filteredArticles.length}
          onSearchChange={handleSearchChange}
          onTerritoryChange={handleTerritoryChange}
          onCountryChange={handleCountryChange}
          onTopicChange={handleTopicChange}
          onSortChange={handleSortChange}
        />

        <p className="news-notice">
          {t('news.aiDisclaimer')}
        </p>

        {sourceNotice ? (
          <p className="news-notice" role="status">
            {sourceNotice}
          </p>
        ) : null}

        {loading ? <NewsSkeleton /> : null}

        {!loading && error ? (
          <div className="news-error-state" role="alert">
            <p>{error}</p>
            <button type="button" className="news-button news-button-secondary" onClick={handleRetry}>
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {!loading && !error && articles.length === 0 ? (
          <NewsEmptyState title={t('news.noNewsAvailable')} />
        ) : null}

        {!loading && !error && articles.length > 0 && filteredArticles.length === 0 ? (
          <NewsEmptyState
            title={t('news.noNewsMatches')}
            actionLabel={t('common.clearFilters')}
            onAction={clearFilters}
          />
        ) : null}

        {!loading && !error && filteredArticles.length > 0 ? (
          <>
            <FeaturedNews article={displayedFeaturedArticle} onUnavailableSource={showUnavailableSource} />

            <h2 className="news-section-title">{t('news.latestNews')}</h2>
            {visibleArticles.length ? (
              <div className="news-grid">
                {visibleArticles.map((article) => (
                  <NewsCard article={article} key={article.id} />
                ))}
              </div>
            ) : (
              <NewsEmptyState title={t('news.noNewsAvailable')} />
            )}

            {hasMore ? (
              <div className="news-load-more">
                <button
                  type="button"
                  className="news-button news-button-secondary"
                  onClick={() => setVisibleCount((count) => count + LOAD_MORE_COUNT)}
                >
                  {t('news.loadMoreNews')}
                </button>
              </div>
            ) : null}

            {!hasMore && hasFilters && visibleArticles.length > 0 ? (
              <div className="news-load-more">
                <button type="button" className="news-button news-button-secondary" onClick={clearFilters}>
                  {t('common.clearFilters')}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default NewsPage;
