import { useState } from 'react';
import { Button, Field, Select, TextArea, TextInput } from '../../components/ui';
import { COLORS, FONT, RADII } from '../../theme';
import { TERRITORY_OPTIONS, TOPIC_OPTIONS } from '../../data/mockCommunityPosts';
import AttachmentPicker from './AttachmentPicker';

const EMPTY_FORM = { title: '', body: '', topic: TOPIC_OPTIONS[0], territory: TERRITORY_OPTIONS[0], attachments: [] };

// onSubmit(form) returns a Promise; the parent keeps this form mounted (and its
// state intact) on failure and only unmounts it on success, so there is no
// manual reset here. `submitError` is owned by the parent and shown in a live
// region; `onDirty` lets the parent clear a stale error as the user edits.
const NewPostForm = ({ onSubmit, onCancel, submitting, submitError, onDirty }) => {
  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = form.title.trim() && form.body.trim() && !submitting;

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    onDirty?.();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={styles.heading}>Start a discussion</h2>
      <p style={styles.subheading}>Ask a question, share an update, or start a conversation about Borneo.</p>

      <Field label="Title" required>
        <TextInput
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="What's this about?"
          maxLength={120}
        />
      </Field>

      <div style={styles.row}>
        <Field label="Topic" style={styles.rowField}>
          <Select
            value={form.topic}
            onChange={(topic) => update({ topic })}
            options={TOPIC_OPTIONS}
            style={{ width: '100%' }}
          />
        </Field>
        <Field label="Region" style={styles.rowField}>
          <Select
            value={form.territory}
            onChange={(territory) => update({ territory })}
            options={TERRITORY_OPTIONS}
            style={{ width: '100%' }}
          />
        </Field>
      </div>

      <Field label="Details" required>
        <TextArea
          value={form.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Share the details of your discussion…"
          rows={5}
        />
      </Field>

      <Field label="Attachments" hint="optional">
        <AttachmentPicker
          files={form.attachments}
          onChange={(attachments) => update({ attachments })}
          disabled={submitting}
        />
      </Field>

      {submitError && (
        <div style={styles.error} role="alert" aria-live="assertive">
          {submitError}
        </div>
      )}

      <div style={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? 'Publishing…' : 'Post discussion'}
        </Button>
      </div>
    </form>
  );
};

const styles = {
  heading: { fontSize: 22, fontWeight: 800, color: COLORS.ink, margin: '0 0 4px', fontFamily: FONT },
  subheading: { fontSize: 14, color: COLORS.muted, margin: '0 0 20px', fontFamily: FONT },
  row: { display: 'flex', gap: 16 },
  rowField: { flex: 1 },
  error: {
    background: COLORS.redSoft,
    color: COLORS.red,
    borderRadius: RADII.md,
    padding: '10px 14px',
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: FONT,
    margin: '0 0 16px',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
};

export default NewPostForm;
