import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { authService } from '../../services/authService';

const EMPTY_PROFILE = {
  phoneCountryCode: '',
  phoneNumber: '',
  addressLine: '',
  city: '',
  state: '',
  postalCode: '',
};
const EMPTY_PASSWORDS = { currentPassword: '', password: '', confirmPassword: '' };
const EMPTY_EMAIL = { newEmail: '', currentPassword: '' };

const nullableToEmpty = (profile) => Object.fromEntries(
  Object.entries(profile).map(([key, value]) => [key, value ?? '']),
);

export default function MyProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [names, setNames] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [version, setVersion] = useState(1);
  const [editMode, setEditMode] = useState(null);
  const [detailsForm, setDetailsForm] = useState({});
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [emailForm, setEmailForm] = useState(EMPTY_EMAIL);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      const data = await authService.getProfile();
      setProfile(nullableToEmpty(data.profile));
      setNames({ firstName: data.user.firstName, lastName: data.user.lastName });
      setVersion(data.version);
      updateUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3000);
  };

  const openDetails = () => {
    setError('');
    setFieldErrors({});
    setDetailsForm({ ...names, ...profile });
    setEditMode('details');
  };

  const saveDetails = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const data = await authService.updateProfile({ version, ...detailsForm });
      setProfile(nullableToEmpty(data.profile));
      setNames({ firstName: data.user.firstName, lastName: data.user.lastName });
      setVersion(data.version);
      updateUser(data.user);
      setEditMode(null);
      showToast('Your personal details have been updated.');
    } catch (err) {
      if (err.code === 'PROFILE_VERSION_CONFLICT') {
        await loadProfile();
        setError('Your profile changed in another session. The latest details have been loaded; please try again.');
      } else {
        setError(err.message);
        setFieldErrors(err.fieldErrors || {});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      await authService.changePassword(
        passwords.currentPassword,
        passwords.password,
        passwords.confirmPassword,
      );
      setPasswords(EMPTY_PASSWORDS);
      setEditMode(null);
      showToast('Your password has been changed. Other sessions were signed out.');
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  const requestEmailChange = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const result = await authService.changeEmail(emailForm.newEmail, emailForm.currentPassword);
      setEmailForm(EMPTY_EMAIL);
      setEditMode(null);
      showToast(result.message);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  const signOutEverywhere = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      await authService.logoutAll(logoutPassword);
      authService.clearMemory();
      updateUser(null);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setSubmitting(false);
    }
  };

  const updateForm = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  };

  const fullName = `${names.firstName} ${names.lastName}`.trim();
  const phone = `${profile.phoneCountryCode}${profile.phoneNumber}`;
  const address = [profile.addressLine, profile.city, profile.postalCode, profile.state].filter(Boolean).join(', ');

  if (loading) return <div style={styles.content}>Loading your profile…</div>;

  return (
    <div style={styles.content}>
      <h1 style={styles.pageTitle}>My Profile</h1>
      {error && <div role="alert" style={styles.error}>{error}</div>}

      <Card title="Personal Details" action={editMode !== 'details' && <EditButton onClick={openDetails} />}>
        {editMode === 'details' ? (
          <form style={styles.form} onSubmit={saveDetails}>
            <div style={styles.formGrid}>
              <Field label="First Name" error={fieldErrors.firstName} name="firstName" value={detailsForm.firstName || ''} onChange={updateForm(setDetailsForm)} required maxLength={100} />
              <Field label="Last Name" error={fieldErrors.lastName} name="lastName" value={detailsForm.lastName || ''} onChange={updateForm(setDetailsForm)} required maxLength={100} />
            </div>
            <Field label="Email" type="email" value={user?.email || ''} readOnly />
            <div style={styles.formGrid}>
              <Field label="Phone country code" error={fieldErrors.phoneCountryCode} name="phoneCountryCode" value={detailsForm.phoneCountryCode || ''} onChange={updateForm(setDetailsForm)} maxLength={8} />
              <Field label="Phone number" error={fieldErrors.phoneNumber} name="phoneNumber" value={detailsForm.phoneNumber || ''} onChange={updateForm(setDetailsForm)} maxLength={32} />
            </div>
            <Field label="Address" error={fieldErrors.addressLine} name="addressLine" value={detailsForm.addressLine || ''} onChange={updateForm(setDetailsForm)} maxLength={200} />
            <div style={styles.formGrid}>
              <Field label="City" error={fieldErrors.city} name="city" value={detailsForm.city || ''} onChange={updateForm(setDetailsForm)} maxLength={100} />
              <Field label="State" error={fieldErrors.state} name="state" value={detailsForm.state || ''} onChange={updateForm(setDetailsForm)} maxLength={100} />
            </div>
            <Field label="Postal code" error={fieldErrors.postalCode} name="postalCode" value={detailsForm.postalCode || ''} onChange={updateForm(setDetailsForm)} maxLength={20} />
            <FormActions submitting={submitting} onCancel={() => setEditMode(null)} />
          </form>
        ) : (
          <div>
            <Detail label="Name" value={fullName || '—'} />
            <Detail label="Email" value={user?.email || '—'} />
            <Detail label="Phone" value={phone || '—'} />
            <Detail label="Address" value={address || '—'} />
          </div>
        )}
      </Card>

      <Card title="Password" action={editMode !== 'password' && <EditButton onClick={() => { setError(''); setPasswords(EMPTY_PASSWORDS); setEditMode('password'); }} />}>
        {editMode === 'password' ? (
          <form style={styles.form} onSubmit={savePassword}>
            <Field label="Current password" error={fieldErrors.currentPassword} type="password" name="currentPassword" value={passwords.currentPassword} onChange={updateForm(setPasswords)} required maxLength={128} autoComplete="current-password" />
            <Field label="New password" error={fieldErrors.password} type="password" name="password" value={passwords.password} onChange={updateForm(setPasswords)} required minLength={12} maxLength={128} autoComplete="new-password" />
            <Field label="Confirm password" error={fieldErrors.confirmPassword} type="password" name="confirmPassword" value={passwords.confirmPassword} onChange={updateForm(setPasswords)} required maxLength={128} autoComplete="new-password" />
            <FormActions submitting={submitting} onCancel={() => setEditMode(null)} />
          </form>
        ) : <Detail label="Password" value="••••••••" secret />}
      </Card>

      <Card title="Sign-in Email" action={editMode !== 'email' && <EditButton label="Change" onClick={() => { setError(''); setEmailForm(EMPTY_EMAIL); setEditMode('email'); }} />}>
        {editMode === 'email' ? (
          <form style={styles.form} onSubmit={requestEmailChange}>
            <Field label="New email" error={fieldErrors.newEmail} type="email" name="newEmail" value={emailForm.newEmail} onChange={updateForm(setEmailForm)} required maxLength={254} />
            <Field label="Current password" error={fieldErrors.currentPassword} type="password" name="currentPassword" value={emailForm.currentPassword} onChange={updateForm(setEmailForm)} required maxLength={128} autoComplete="current-password" />
            <p style={styles.hint}>The new address replaces your current email only after you confirm it.</p>
            <FormActions submitting={submitting} onCancel={() => setEditMode(null)} submitLabel="Send Confirmation" />
          </form>
        ) : <Detail label="Email" value={user?.email || '—'} />}
      </Card>

      <Card title="Sign Out All Devices">
        <p style={styles.hint}>Enter your current password to end every active session, including this one.</p>
        <form style={styles.form} onSubmit={signOutEverywhere}>
          <Field label="Current password" error={fieldErrors.currentPassword} type="password" value={logoutPassword} onChange={(event) => setLogoutPassword(event.target.value)} required maxLength={128} autoComplete="current-password" />
          <div style={styles.formActions}>
            <button type="submit" style={styles.dangerBtn} disabled={submitting}>{submitting ? 'Please wait…' : 'Sign Out All Devices'}</button>
          </div>
        </form>
      </Card>

      {toast && (
        <div style={styles.toastOverlay} role="status">
          <div style={styles.toastBox}><div style={styles.toastIcon}>✓</div><p style={styles.toastText}>{toast}</p></div>
        </div>
      )}
    </div>
  );
}

function Card({ title, action, children }) {
  return <section style={styles.card}>
    <div style={styles.cardHeader}><span style={styles.cardLabel}>{title}</span>{action}</div>
    {children}
  </section>;
}

function Field({ label, error, ...props }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span><input style={styles.input} aria-invalid={Boolean(error)} {...props} />{error && <span role="alert" style={styles.fieldError}>{error}</span>}</label>;
}

function Detail({ label, value, secret = false }) {
  return <div style={styles.detailRow}><span style={styles.detailLabel}>{label}</span><span style={secret ? styles.secretValue : styles.detailValue}>{value}</span></div>;
}

function EditButton({ onClick, label = 'Edit' }) {
  return <button type="button" style={styles.editBtn} onClick={onClick}><EditIcon /> {label}</button>;
}

function FormActions({ submitting, onCancel, submitLabel = 'Save Changes' }) {
  return <div style={styles.formActions}>
    <button type="button" style={styles.cancelBtn} onClick={onCancel} disabled={submitting}>Cancel</button>
    <button type="submit" style={styles.saveBtn} disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
  </div>;
}

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: 'middle' }}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const styles = {
  content: { padding: '32px 40px 70px', boxSizing: 'border-box', maxWidth: 860, width: '100%', margin: '0 auto' },
  pageTitle: { fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 16 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardLabel: { fontSize: 16, fontWeight: 700, color: '#111827' },
  editBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  detailRow: { display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'flex-start' },
  detailLabel: { minWidth: 90, fontSize: 14, fontWeight: 600, color: '#111827' },
  detailValue: { fontSize: 14, color: '#374151', flex: 1 },
  secretValue: { fontSize: 18, color: '#374151', flex: 1, letterSpacing: 3 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  fieldError: { fontSize: 12, color: '#b91c1c' },
  input: { padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', color: '#111827', backgroundColor: '#fff', boxSizing: 'border-box', width: '100%' },
  hint: { fontSize: 12, color: '#6b7280', margin: 0 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn: { padding: '10px 20px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' },
  saveBtn: { padding: '10px 28px', borderRadius: 10, border: 'none', background: '#d97706', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  dangerBtn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#b91c1c', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  error: { padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16 },
  toastOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toastBox: { backgroundColor: '#fff', borderRadius: 16, padding: '36px 48px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', minWidth: 300 },
  toastIcon: { width: 52, height: 52, borderRadius: '50%', backgroundColor: '#22c55e', color: '#fff', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  toastText: { fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 },
};
