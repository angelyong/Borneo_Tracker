import { useEffect, useMemo, useState } from 'react';
import FeaturedNews from './FeaturedNews';
import NewsCard from './NewsCard';
import NewsEmptyState from './NewsEmptyState';
import NewsFilters from './NewsFilters';
import NewsSkeleton from './NewsSkeleton';
import { getNewsArticles } from '../../services/newsService';
import { matchesNewsSearch } from './newsUtils';
import './news.css';

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_COUNT = 6;

const NewsPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [territory, setTerritory] = useState('All Territories');
  const [country, setCountry] = useState('All Countries');
  const [topic, setTopic] = useState('All Topics');
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
      setError('News could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getNewsArticles()
      .then((nextArticles) => {
        if (!cancelled) {
          setArticles(nextArticles);
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
    return ['All Topics', ...uniqueTopics];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles
      .filter((article) => (territory === 'All Territories' ? true : article.territories?.includes(territory)))
      .filter((article) => (country === 'All Countries' ? true : article.country === country))
      .filter((article) => (topic === 'All Topics' ? true : article.beatLabel === topic))
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
    territory !== 'All Territories' ||
    country !== 'All Countries' ||
    topic !== 'All Topics';
  const hasMore = visibleCount < latestArticles.length;

  const clearFilters = () => {
    setSearch('');
    setTerritory('All Territories');
    setCountry('All Countries');
    setTopic('All Topics');
    setSort('latest');
  };

  const showUnavailableSource = () => {
    setSourceNotice('Original source is not available yet.');
  };

  return (
    <div className="news-page">
      <div className="news-page-inner">
        <header className="news-header">
          <div>
            <h1>News &amp; Insights</h1>
            <p>AI-curated sustainability news from trusted publishers across Borneo</p>
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
          Articles are summarised and rewritten by AI. Original sources are always credited.
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
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !error && articles.length === 0 ? (
          <NewsEmptyState title="No news is available yet." />
        ) : null}

        {!loading && !error && articles.length > 0 && filteredArticles.length === 0 ? (
          <NewsEmptyState
            title="No news matches your search or filters."
            actionLabel="Clear Filters"
            onAction={clearFilters}
          />
        ) : null}

        {!loading && !error && filteredArticles.length > 0 ? (
          <>
            <FeaturedNews article={displayedFeaturedArticle} onUnavailableSource={showUnavailableSource} />

            <h2 className="news-section-title">Latest News</h2>
            {visibleArticles.length ? (
              <div className="news-grid">
                {visibleArticles.map((article) => (
                  <NewsCard article={article} key={article.id} />
                ))}
              </div>
            ) : (
              <NewsEmptyState title="No news is available yet." />
            )}

            {hasMore ? (
              <div className="news-load-more">
                <button
                  type="button"
                  className="news-button news-button-secondary"
                  onClick={() => setVisibleCount((count) => count + LOAD_MORE_COUNT)}
                >
                  Load More News
                </button>
              </div>
            ) : null}

            {!hasMore && hasFilters && visibleArticles.length > 0 ? (
              <div className="news-load-more">
                <button type="button" className="news-button news-button-secondary" onClick={clearFilters}>
                  Clear Filters
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
