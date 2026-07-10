import { useState } from 'react';

const NewsImage = ({ src, alt, lazy = true, className = '' }) => {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div className={`news-image news-image-placeholder ${className}`} role="img" aria-label={alt}>
        <span>Borneo Tracker</span>
        <strong>News & Insights</strong>
      </div>
    );
  }

  return (
    <img
      className={`news-image ${className}`}
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      onError={() => setFailed(true)}
    />
  );
};

export default NewsImage;
