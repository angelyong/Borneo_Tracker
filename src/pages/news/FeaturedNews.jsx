import { Link } from 'react-router-dom';
import NewsImage from './NewsImage';
import { formatCountryLabel, formatNewsDate, formatSourceCount, truncateText } from './newsUtils';

const FeaturedNews = ({ article, onUnavailableSource }) => {
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
        <span className="news-featured-flag">★ Featured</span>
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
        <div className="news-ai-label">AI Summary</div>

        <div className="news-card-meta">
          <span className="news-source-badge">{formatSourceCount(article.sourceCount)}</span>
          <span>{formatNewsDate(article.publishedAt)}</span>
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
            Read Summary
          </Link>
          {primarySourceUrl ? (
            <a
              href={primarySourceUrl}
              className="news-button news-button-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Original Source
            </a>
          ) : (
            <button type="button" className="news-button news-button-secondary" onClick={onUnavailableSource}>
              Original Source
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedNews;
