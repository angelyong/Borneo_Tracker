import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import NewsImage from './NewsImage';
import { formatCountryLabel, formatNewsDate, formatSourceCount, truncateText } from './newsUtils';

const FeaturedNews = ({ article, onUnavailableSource }) => {
  const { t, i18n } = useTranslation();
  if (!article) return null;

  const primarySourceUrl = article.sources?.[0]?.url;

  return (
    <section className="news-featured" aria-labelledby="featured-news-title">
      <div className="news-featured-media">
        <NewsImage
          src={article.imageUrl}
          alt={`${article.title} image`}
          beat={article.beat}
          beatLabel={article.beatLabel}
          lazy={false}
        />
        <span className="news-featured-flag">★ {t('news.featured')}</span>
        <span className="news-featured-media-beat">{article.beatLabel}</span>
      </div>

      <div className="news-featured-content">
        <div className="news-chip-row">
          {article.territories.map((territory) => (
            <span className="news-chip news-chip-territory" key={territory}>
              {territory}
            </span>
          ))}
          <span className="news-chip news-chip-country">{formatCountryLabel(article.country)}</span>
        </div>

        <h2 id="featured-news-title">{article.title}</h2>
        <p>{truncateText(article.body, 260)}</p>
        <div className="news-ai-label">{t('news.aiSummary')}</div>

        <div className="news-card-meta">
          <span className="news-source-badge">{formatSourceCount(article.sourceCount, t)}</span>
          <span>{formatNewsDate(article.publishedAt, i18n.language)}</span>
        </div>

        <div className="news-tag-group" aria-label="SDG tags">
          {article.sdg.map((tag) => (
            <span className="news-tag news-tag-sdg" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="news-action-row">
          <Link to={`/news/${article.id}`} className="news-button">
            {t('news.readSummary')}
          </Link>
          {primarySourceUrl ? (
            <a
              href={primarySourceUrl}
              className="news-button news-button-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('news.originalSource')}
            </a>
          ) : (
            <button type="button" className="news-button news-button-secondary" onClick={onUnavailableSource}>
              {t('news.originalSource')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedNews;
