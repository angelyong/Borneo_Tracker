// My Profile — Figma redesign: profile view → edit form with phone/address fields,
// change-password form, success modals. Backed by the mock auth store.
import { useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../theme';
import { Button, Field, PasswordInput, SuccessModal, TextInput } from '../../components/ui';

const cardStyle = {
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 2px 12px rgba(15,42,30,0.08)',
  padding: '28px 32px',
};

function Row({ k, v }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 2px',
        borderBottom: '1px solid #F3F4F6',
        fontSize: 15,
      }}
    >
      <span style={{ color: COLORS.muted, fontWeight: 600 }}>{k}</span>
      <span style={{ fontWeight: 700, textAlign: 'right' }}>{v || '—'}</span>
    </div>
  );
}

export default function MyProfile() {
  const { user, updateProfile } = useAuth();
  const [mode, setMode] = useState('view'); // view | edit | password
  const [draft, setDraft] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!user) return null;

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 1800);
  };

  const startEdit = () => {
    setDraft({ ...user });
    setError('');
    setMode('edit');
  };

  const saveProfile = (e) => {
    e.preventDefault();
    updateProfile(draft);
    setMode('view');
    showSuccess('Your changes have been updated.');
  };

  const savePassword = (e) => {
    e.preventDefault();
    setError('');
    if (pw.current !== user.password) return setError('Current password is incorrect.');
    if (pw.next.length < 8) return setError('New password must be at least 8 characters.');
    if (pw.next !== pw.confirm) return setError('Passwords do not match.');
    updateProfile({ password: pw.next });
    setPw({ current: '', next: '', confirm: '' });
    setMode('view');
    showSuccess('Your changes have been updated.');
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <Layout>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 22px' }}>
          {mode === 'edit' ? 'Edit Profile' : mode === 'password' ? 'Edit Profile' : 'My Profile'}
        </h1>

        {mode === 'view' && (
          <>
            <div style={cardStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Personal Details</h2>
                <button
                  onClick={startEdit}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    background: '#fff',
                    borderRadius: 8,
                    padding: '7px 18px',
                    fontWeight: 700,
                    fontSize: 13.5,
                  }}
                >
                  Edit ✏️
                </button>
              </div>
              <Row k="Name" v={`${user.firstName} ${user.lastName}`.trim()} />
              <Row k="Email" v={user.email} />
              <Row k="Phone Number" v={user.phone ? `${user.phoneCode} ${user.phone}` : ''} />
              <Row
                k="Address"
                v={[user.address, user.city, user.state, user.postalCode].filter(Boolean).join(', ')}
              />
            </div>

            <div style={{ ...cardStyle, marginTop: 22 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Password</h2>
                <button
                  onClick={() => {
                    setError('');
                    setMode('password');
                  }}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    background: '#fff',
                    borderRadius: 8,
                    padding: '7px 18px',
                    fontWeight: 700,
                    fontSize: 13.5,
                  }}
                >
                  Change
                </button>
              </div>
              <Row k="Password" v="••••••••" />
            </div>
          </>
        )}

        {mode === 'edit' && draft && (
          <form onSubmit={saveProfile} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24 }}>
              <Field label="First Name">
                <TextInput value={draft.firstName} onChange={set('firstName')} required />
              </Field>
              <Field label="Last Name">
                <TextInput value={draft.lastName} onChange={set('lastName')} />
              </Field>
            </div>
            <Field label="Email">
              <TextInput type="email" value={draft.email} onChange={set('email')} required />
            </Field>
            <Field label="Phone Number">
              <div style={{ display: 'flex', gap: 10 }}>
                <TextInput value={draft.phoneCode} onChange={set('phoneCode')} style={{ width: 86 }} />
                <TextInput value={draft.phone} onChange={set('phone')} style={{ flex: 1 }} />
              </div>
            </Field>
            <Field label="Address" required hint="House No. , Building, Street name">
              <TextInput value={draft.address} onChange={set('address')} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24 }}>
              <Field label="City">
                <TextInput value={draft.city} onChange={set('city')} />
              </Field>
              <Field label="State">
                <TextInput value={draft.state} onChange={set('state')} />
              </Field>
            </div>
            <Field label="Postal code" style={{ maxWidth: '48%' }}>
              <TextInput value={draft.postalCode} onChange={set('postalCode')} />
            </Field>

            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              <Button type="submit" style={{ flex: 1 }}>
                Save Changes
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {mode === 'password' && (
          <form onSubmit={savePassword} style={cardStyle}>
            <Field label="Current Password">
              <PasswordInput
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                required
              />
            </Field>
            <Field label="New Password">
              <PasswordInput
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                required
              />
            </Field>
            <Field label="Confirm Password">
              <PasswordInput
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                required
              />
            </Field>
            {error && (
              <div style={{ color: COLORS.red, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 14 }}>
              <Button type="submit" style={{ flex: 1 }}>
                Submit
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {error && mode === 'edit' && (
          <div style={{ color: COLORS.red, fontSize: 14, fontWeight: 600, marginTop: 12 }}>{error}</div>
        )}
      </div>

      <SuccessModal open={!!successMsg} onClose={() => setSuccessMsg('')} message={successMsg} />
    </Layout>
  );
}
