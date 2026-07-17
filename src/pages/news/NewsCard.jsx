import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import NewsImage from './NewsImage';
import { formatCountryLabel, formatRelativeTime, formatSourceCount, truncateText } from './newsUtils';

const NewsCard = ({ article }) => {
  const { t, i18n } = useTranslation();
  return (
    <article className="news-card">
      <Link to={`/news/${article.id}`} className="news-card-image-link" aria-label={article.title}>
        <NewsImage
          src={article.imageUrl}
          alt={`${article.title} image`}
          beat={article.beat}
          beatLabel={article.beatLabel}
        />
        <span className="news-card-beat-flag">{article.beatLabel}</span>
      </Link>

      <div className="news-card-body">
        <div className="news-chip-row">
          {article.territories.map((territory) => (
            <span className="news-chip news-chip-territory" key={territory}>
              {territory}
            </span>
          ))}
          <span className="news-chip news-chip-country">{formatCountryLabel(article.country)}</span>
        </div>

        <h2 className="news-card-title">
          <Link to={`/news/${article.id}`}>{article.title}</Link>
        </h2>

        <p className="news-card-summary">{truncateText(article.body)}</p>

        <div className="news-card-footer">
          <div className="news-card-meta">
            <span className="news-source-badge">{formatSourceCount(article.sourceCount, t)}</span>
            <span className="news-ai-label">{t('news.aiSummary')}</span>
          </div>
          <div className="news-card-footer-row">
            <span className="news-meta-time">{formatRelativeTime(article.publishedAt, i18n.language)}</span>
            <Link to={`/news/${article.id}`} className="news-text-link">
              {t('news.readSummary')} &rarr;
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};

export default NewsCard;
