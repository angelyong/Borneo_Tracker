const NewsEmptyState = ({ title, actionLabel, onAction }) => (
  <div className="news-empty-state">
    <p>{title}</p>
    {actionLabel ? (
      <button type="button" className="news-button news-button-secondary" onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export default NewsEmptyState;
