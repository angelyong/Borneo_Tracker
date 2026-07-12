import { useState } from 'react';
import { Button, Field, Select, TextArea, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';
import { TERRITORY_OPTIONS, TOPIC_OPTIONS } from '../../data/mockCommunityPosts';

const EMPTY_FORM = { title: '', body: '', topic: TOPIC_OPTIONS[0], territory: TERRITORY_OPTIONS[0] };

const NewPostForm = ({ onSubmit, onCancel, submitting }) => {
  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = form.title.trim() && form.body.trim() && !submitting;

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
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What's this about?"
          maxLength={120}
        />
      </Field>

      <div style={styles.row}>
        <Field label="Topic" style={styles.rowField}>
          <Select
            value={form.topic}
            onChange={(topic) => setForm({ ...form, topic })}
            options={TOPIC_OPTIONS}
            style={{ width: '100%' }}
          />
        </Field>
        <Field label="Region" style={styles.rowField}>
          <Select
            value={form.territory}
            onChange={(territory) => setForm({ ...form, territory })}
            options={TERRITORY_OPTIONS}
            style={{ width: '100%' }}
          />
        </Field>
      </div>

      <Field label="Details" required>
        <TextArea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Share the details of your discussion…"
          rows={5}
        />
      </Field>

      <div style={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? 'Posting…' : 'Post discussion'}
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
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
};

export default NewPostForm;
