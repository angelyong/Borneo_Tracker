import { Link } from 'react-router-dom';
import NewsImage from './NewsImage';
import { formatNewsDate } from './newsUtils';

const FeaturedNews = ({ article, onUnavailableSource }) => {
  if (!article) return null;

  return (
    <section className="news-featured" aria-labelledby="featured-news-title">
      <div className="news-featured-media">
        <NewsImage src={article.imageUrl} alt={`${article.title} image`} lazy={false} />
      </div>

      <div className="news-featured-content">
        <span className="news-featured-label">Featured</span>
        <div className="news-chip-row">
          <span className="news-chip news-chip-territory">{article.territory}</span>
          <span className="news-chip">{article.category}</span>
        </div>

        <h2 id="featured-news-title">{article.title}</h2>
        <p>{article.aiSummary}</p>
        <div className="news-ai-label">AI Summary</div>

        <div className="news-card-meta">
          <span>{article.sourceName}</span>
          <span>{formatNewsDate(article.publishedAt)}</span>
        </div>

        <div className="news-tag-group" aria-label="SDG tags">
          {article.sdgTags.map((tag) => (
            <span className="news-tag news-tag-sdg" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="news-tag-group" aria-label="Indicator tags">
          {article.indicatorTags.map((tag) => (
            <span className="news-tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <div className="news-action-row">
          <Link to={`/news/${article.id}`} className="news-button">
            Read Summary
          </Link>
          {article.sourceUrl ? (
            <a
              href={article.sourceUrl}
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
