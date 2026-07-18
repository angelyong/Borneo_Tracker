const AnswerSources = ({ sources = [] }) => {
  if (!sources.length) return null;

  return (
    <div className="ai-chat-sources" aria-label="Answer sources">
      <div className="ai-chat-sources-title">Related pages</div>

      <div className="ai-chat-sources-list">
        {sources.map((source, index) => {
          const label = [
            source.region,
            source.year,
          ].filter(Boolean).join(' · ');

          const text = label
            ? `${source.title} (${label})`
            : source.title;

          return source.url ? (
            <a
              key={`${source.title}-${index}`}
              href={source.url}
              className="ai-chat-source"
            >
              {text}
            </a>
          ) : (
            <span
              key={`${source.title}-${index}`}
              className="ai-chat-source"
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default AnswerSources;
