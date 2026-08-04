import { useTranslation } from 'react-i18next';

function safeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function sourceText(source, fallback) {
  const parts = [
    source.title,
    source.publisher,
    source.year,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : fallback;
}

const AnswerSources = ({ sources = [] }) => {
  const { t } = useTranslation();
  if (!sources.length) return null;

  const seen = new Set();
  const cleanSources = sources
    .map((source) => ({
      text: sourceText(source, t('aiChat.sourceFallback')),
      url: safeUrl(source.url),
    }))
    .filter((source) => {
      const key = `${source.text}|${source.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!cleanSources.length) return null;

  return (
    <div className="ai-chat-sources" aria-label={t('aiChat.sources')}>
      <div className="ai-chat-sources-title">{t('aiChat.sources')}</div>

      <div className="ai-chat-sources-list">
        {cleanSources.map((source, index) => (
          source.url ? (
            <a
              key={`${source.text}-${index}`}
              href={source.url}
              className="ai-chat-source"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('aiChat.openSource', { source: source.text })}
            >
              {source.text}
            </a>
          ) : (
            <span
              key={`${source.text}-${index}`}
              className="ai-chat-source"
            >
              {source.text}
            </span>
          )
        ))}
      </div>
    </div>
  );
};

export default AnswerSources;
