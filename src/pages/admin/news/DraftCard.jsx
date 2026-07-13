import { useEffect, useRef, useState } from 'react';

const COUNTRY_FLAGS = {
  Malaysia: '🇲🇾',
  Brunei: '🇧🇳',
  Indonesia: '🇮🇩',
};

const CONFIRM_LABELS = {
  published: 'Published',
  rejected: 'Rejected',
  saved: 'Saved',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * A single pending draft in the review queue.
 * Title/body are editable in local state. The async service calls live in the
 * parent (passed as callbacks); terminal actions show a brief confirmation and
 * then ask the parent to drop the card via onRemove.
 */
const DraftCard = ({ draft, onApprove, onPublishEdited, onReject, onSaveEdits, onRemove }) => {
  const [title, setTitle] = useState(draft.title || '');
  const [body, setBody] = useState(draft.body || '');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const removeTimer = useRef(null);

  useEffect(
    () => () => {
      if (removeTimer.current) clearTimeout(removeTimer.current);
    },
    [],
  );

  const flag = COUNTRY_FLAGS[draft.country] || '';
  const sources = Array.isArray(draft.sources) ? draft.sources : [];
  const sourceCount = draft.sourceCount ?? sources.length;
  const sdgTags = Array.isArray(draft.sdg) ? draft.sdg : [];
  const territories = Array.isArray(draft.territories) ? draft.territories : [];

  const run = async (action, outcome, { remove } = {}) => {
    setBusy(true);
    setError('');
    setConfirm('');
    try {
      await action();
      setConfirm(outcome);
      if (remove) {
        removeTimer.current = setTimeout(() => onRemove(draft.id), 900);
      } else {
        setBusy(false);
      }
    } catch {
      setError('That action could not be completed. Please try again.');
      setBusy(false);
    }
  };

  const handleApprove = () => run(() => onApprove(draft.id), 'published', { remove: true });
  const handlePublishEdited = () =>
    run(() => onPublishEdited(draft.id, { title, body }), 'published', { remove: true });
  const handleReject = () => run(() => onReject(draft.id), 'rejected', { remove: true });
  const handleSaveEdits = () => run(() => onSaveEdits(draft.id, { title, body }), 'saved');

  return (
    <article className="draft-card">
      <div className="draft-card-top">
        {draft.imageUrl ? <img className="draft-card-thumb" src={draft.imageUrl} alt="" /> : null}

        <div className="draft-card-fields">
          <div>
            <label className="draft-field-label" htmlFor={`title-${draft.id}`}>
              Title
            </label>
            <input
              id={`title-${draft.id}`}
              className="draft-input"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label className="draft-field-label" htmlFor={`body-${draft.id}`}>
              Body
            </label>
            <textarea
              id={`body-${draft.id}`}
              className="draft-textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>
      </div>

      <div className="draft-chip-row">
        {draft.esgPillar ? (
          <span className="draft-chip draft-chip-pillar" title="ESG pillar">
            {draft.esgPillar}
          </span>
        ) : null}
        {sdgTags.map((tag) => (
          <span className="draft-chip" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <div className="draft-meta">
        {draft.beatLabel ? (
          <span className="draft-meta-item">
            <strong>Beat:</strong> {draft.beatLabel}
          </span>
        ) : null}
        {draft.country ? (
          <span className="draft-meta-item">
            <strong>Country:</strong> {flag} {draft.country}
          </span>
        ) : null}
        {territories.length ? (
          <span className="draft-meta-item">
            <strong>Territories:</strong> {territories.join(', ')}
          </span>
        ) : null}
        {draft.originalLang ? (
          <span className="draft-meta-item">
            <strong>Original language:</strong> {draft.originalLang.toUpperCase()}
          </span>
        ) : null}
        <span className="draft-meta-item">
          <strong>Created:</strong> {formatDate(draft.createdAt)}
        </span>
      </div>

      {draft.aiGenerated ? <span className="draft-ai-label">AI-generated</span> : null}

      <div className="draft-sources">
        <p className="draft-sources-count">
          Reported by {sourceCount} source{sourceCount === 1 ? '' : 's'}
        </p>
        {sources.length ? (
          <ul className="draft-sources-list">
            {sources.map((source) => (
              <li key={`${source.url}-${source.name}`}>
                <a
                  className="draft-source-link"
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.name}
                </a>
                {source.publishedAt ? (
                  <span className="draft-source-date">{formatDate(source.publishedAt)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="draft-readonly-body">No sources listed.</p>
        )}
      </div>

      <div className="draft-actions">
        <button
          type="button"
          className="draft-btn draft-btn-approve"
          onClick={handleApprove}
          disabled={busy}
        >
          Approve
        </button>
        <button
          type="button"
          className="draft-btn draft-btn-publish"
          onClick={handlePublishEdited}
          disabled={busy}
        >
          Save &amp; Publish
        </button>
        <button
          type="button"
          className="draft-btn draft-btn-save"
          onClick={handleSaveEdits}
          disabled={busy}
        >
          Save edits
        </button>
        <button
          type="button"
          className="draft-btn draft-btn-reject"
          onClick={handleReject}
          disabled={busy}
        >
          Reject
        </button>

        {error ? (
          <span className="draft-confirm is-rejected" role="alert">
            {error}
          </span>
        ) : confirm ? (
          <span className={`draft-confirm is-${confirm}`} role="status">
            {CONFIRM_LABELS[confirm]}
          </span>
        ) : busy ? (
          <span className="draft-confirm" role="status">
            Working…
          </span>
        ) : null}
      </div>
    </article>
  );
};

export default DraftCard;
