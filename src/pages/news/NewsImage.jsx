import { useState } from 'react';

// Self-contained, per-beat placeholder art. No network, no assets — a themed
// CSS gradient plus an inline emoji so every article has a visual even when
// imageUrl is empty. Keyed by the article `beat`.
const BEAT_PLACEHOLDERS = {
  fire_haze: { emoji: '🔥', from: '#7c2d12', to: '#f59e0b', glow: 'rgba(245, 158, 11, 0.38)' },
  deforestation: { emoji: '🌳', from: '#14532d', to: '#22c55e', glow: 'rgba(34, 197, 94, 0.34)' },
  floods_weather: { emoji: '🌊', from: '#0c4a6e', to: '#38bdf8', glow: 'rgba(56, 189, 248, 0.36)' },
  conservation: { emoji: '🦧', from: '#134e4a', to: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.34)' },
  policy_dev: { emoji: '⚡', from: '#4c1d95', to: '#a78bfa', glow: 'rgba(167, 139, 250, 0.36)' },
  governance: { emoji: '🏛️', from: '#334155', to: '#94a3b8', glow: 'rgba(148, 163, 184, 0.34)' },
  default: { emoji: '📰', from: '#0d2118', to: '#2a9d8f', glow: 'rgba(74, 222, 128, 0.3)' },
};

const NewsImage = ({ src, alt, lazy = true, className = '', beat = 'default', beatLabel = '' }) => {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    const config = BEAT_PLACEHOLDERS[beat] || BEAT_PLACEHOLDERS.default;
    return (
      <div
        className={`news-image news-image-placeholder ${className}`}
        role="img"
        aria-label={alt}
        data-beat={beat}
        style={{
          background: `radial-gradient(circle at 28% 24%, ${config.glow}, transparent 62%), linear-gradient(135deg, ${config.from}, ${config.to})`,
        }}
      >
        <span className="news-placeholder-icon" aria-hidden="true">
          {config.emoji}
        </span>
        {beatLabel ? <span className="news-placeholder-label">{beatLabel}</span> : null}
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
