const NewsSkeleton = ({ count = 6 }) => (
  <div className="news-grid" aria-label="Loading news">
    {Array.from({ length: count }).map((_, index) => (
      <div className="news-card news-skeleton-card" key={index}>
        <div className="news-skeleton news-skeleton-image" />
        <div className="news-card-body">
          <div className="news-skeleton news-skeleton-line short" />
          <div className="news-skeleton news-skeleton-line" />
          <div className="news-skeleton news-skeleton-line" />
          <div className="news-skeleton news-skeleton-line medium" />
        </div>
      </div>
    ))}
  </div>
);

export default NewsSkeleton;
