// Submit Report — incident form with per-type extra fields, geolocation helper,
// photo upload preview. Stores to the local mock report store.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS, RADII } from '../../theme';
import { Button, Field, Icons, Select, SuccessModal, TextArea, TextInput } from '../../components/ui';
import {
  INCIDENT_TYPES,
  REGIONS,
  SEVERITIES,
  TYPE_EXTRA_FIELDS,
  useReports,
} from '../../data/reportsStore';

export default function SubmitReport() {
  const { user } = useAuth();
  const { addReport } = useReports();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    type: '',
    severity: '',
    location: '',
    region: '',
    date: '',
    time: '',
    extra: '',
    description: '',
    photo: null,
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const extraField = TYPE_EXTRA_FIELDS[form.type];

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        set('location')(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
      () => setError('Could not access your location — please type it manually.'),
    );
  };

  const onPhoto = (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setError('Image too large (max 20 MB).');
    const reader = new FileReader();
    reader.onload = () => set('photo')(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.type || !form.severity || !form.location || !form.region || !form.date || !form.description) {
      return setError('Please fill in all required fields.');
    }
    addReport({
      ...form,
      submittedBy: `${user.firstName}${user.lastName ? '.' + user.lastName[0] : ''}`,
      userId: user.id,
    });
    setDone(true);
    setTimeout(() => navigate('/report-tracking'), 1500);
  };

  return (
    <Layout>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 20px' }}>
          Submit Report
        </h1>

        <form
          onSubmit={submit}
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 2px 12px rgba(15,42,30,0.08)',
            padding: '30px 34px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 26 }}>
            <Field label="Incident Type" required>
              <Select
                options={['', ...INCIDENT_TYPES]}
                value={form.type}
                onChange={(v) => {
                  set('type')(v);
                  set('extra')('');
                }}
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Severity Level" required>
              <Select
                options={['', ...SEVERITIES]}
                value={form.severity}
                onChange={set('severity')}
                style={{ width: '100%' }}
              />
            </Field>

            <Field label="Location" required>
              <div style={{ position: 'relative' }}>
                <TextInput
                  value={form.location}
                  onChange={(e) => set('location')(e.target.value)}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={locate}
                  title="Use my location"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: COLORS.muted,
                    padding: 4,
                  }}
                >
                  <Icons.Crosshair size={20} />
                </button>
              </div>
            </Field>
            <Field label="Region" required>
              <Select
                options={['', ...REGIONS]}
                value={form.region}
                onChange={set('region')}
                style={{ width: '100%' }}
              />
            </Field>

            <Field label="Date" required>
              <TextInput type="date" value={form.date} onChange={(e) => set('date')(e.target.value)} />
            </Field>
            <Field label="Time">
              <TextInput type="time" value={form.time} onChange={(e) => set('time')(e.target.value)} />
            </Field>
          </div>

          {extraField && (
            <Field label={extraField.label} required>
              <Select
                options={['', ...extraField.options]}
                value={form.extra}
                onChange={set('extra')}
                style={{ width: '48%' }}
              />
            </Field>
          )}

          <Field label="Description" required>
            <TextArea value={form.description} onChange={(e) => set('description')(e.target.value)} />
          </Field>

          <Field label="Photo Evidence">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onPhoto(e.dataTransfer.files?.[0]);
              }}
              style={{
                border: `1.5px dashed ${COLORS.border}`,
                borderRadius: RADII.md,
                background: '#FAFAF8',
                padding: 22,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              {form.photo ? (
                <img src={form.photo} alt="Preview" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8 }} />
              ) : (
                <>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: '8px 16px',
                      fontWeight: 700,
                      fontSize: 14,
                      background: '#fff',
                    }}
                  >
                    <Icons.Upload size={17} /> Upload
                  </div>
                  <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 10 }}>
                    Choose images or drag &amp; drop it here.
                    <br />
                    JPG, JPEG, PNG and WEBP. Max 20 MB.
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </div>
          </Field>

          {error && (
            <div style={{ color: COLORS.red, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <Button type="submit" style={{ width: '100%' }}>
            Submit
          </Button>
        </form>
      </div>

      <SuccessModal open={done} message="Report submitted for review." />
    </Layout>
  );
}
