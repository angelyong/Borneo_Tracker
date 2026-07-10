import { Link } from 'react-router-dom';
import NewsImage from './NewsImage';
import { formatRelativeTime, truncateText } from './newsUtils';

const NewsCard = ({ article }) => (
  <article className="news-card">
    <Link to={`/news/${article.id}`} className="news-card-image-link" aria-label={article.title}>
      <NewsImage src={article.imageUrl} alt={`${article.title} image`} />
    </Link>

    <div className="news-card-body">
      <div className="news-chip-row">
        <span className="news-chip news-chip-territory">{article.territory}</span>
        <span className="news-chip">{article.category}</span>
      </div>

      <h2 className="news-card-title">
        <Link to={`/news/${article.id}`}>{article.title}</Link>
      </h2>

      <p className="news-card-summary">{truncateText(article.aiSummary)}</p>
      <div className="news-ai-label">AI Summary</div>

      <div className="news-card-meta">
        <span>{article.sourceName}</span>
        <span>{formatRelativeTime(article.publishedAt)}</span>
      </div>

      <Link to={`/news/${article.id}`} className="news-text-link">
        Read Summary
      </Link>
    </div>
  </article>
);

export default NewsCard;
