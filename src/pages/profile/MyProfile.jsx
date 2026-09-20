// pages/profile/MyProfile.jsx
// Personal Details card + Password card, each with an inline edit form.
// Details persist to public.profiles (own row); the password change re-checks
// the current password first, then goes through Supabase Auth.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';

const EMPTY_USER = {
  firstName: '', lastName: '', email: '',
  phone: '', phoneCode: '+60',
  addressLine: '', city: '', state: '', postal: '',
};

// Phone is stored as one string ("+60123456789"); the form shows it as a
// country-code select + local number.
const splitPhone = (raw) => {
  const value = (raw || '').trim();
  const code = ['+673', '+65', '+62', '+60'].find(c => value.startsWith(c));
  return code ? { phoneCode: code, phone: value.slice(code.length) } : { phoneCode: '+60', phone: value };
};

const fromProfile = (profile, authUser) => ({
  ...EMPTY_USER,
  firstName:   profile?.first_name   || '',
  lastName:    profile?.last_name    || '',
  email:       authUser?.email       || '',
  ...splitPhone(profile?.phone),
  addressLine: profile?.address_line || '',
  city:        profile?.city         || '',
  state:       profile?.state        || '',
  postal:      profile?.postal_code  || '',
});

export default function MyProfile() {
  const { t } = useTranslation();
  const { user: authUser, profile, updateProfile, updatePassword, reauthenticate } = useAuth();
  // Derived, not mirrored: a successful save reloads `profile`, which re-renders this.
  const user = useMemo(() => fromProfile(profile, authUser), [profile, authUser]);
  const [editMode, setEditMode]           = useState(null);   // 'details' | 'password' | null
  const [form, setForm]                   = useState({});
  const [toast, setToast]                 = useState(false);
  const [pwForm, setPwForm]               = useState({ current: '', next: '', confirm: '' });
  const [error, setError]                 = useState('');
  const [busy, setBusy]                   = useState(false);

  // ── Open edit panels ──────────────────────────────────────────────────────
  const openDetails = () => {
    setForm({ ...user });
    setError('');
    setEditMode('details');
  };
  const openPassword = () => {
    setPwForm({ current: '', next: '', confirm: '' });
    setError('');
    setEditMode('password');
  };
  const closeEdit = () => {
    setEditMode(null);
    setError('');
  };

  // ── Save details ──────────────────────────────────────────────────────────
  const saveDetails = async () => {
    setBusy(true);
    setError('');
    try {
      const phone = form.phone.trim() ? `${form.phoneCode}${form.phone.trim()}` : '';
      await updateProfile({
        first_name:   form.firstName.trim(),
        last_name:    form.lastName.trim(),
        phone,
        address_line: form.addressLine.trim(),
        city:         form.city.trim(),
        state:        form.state.trim(),
        postal_code:  form.postal.trim(),
      });
      setEditMode(null);
      showToast();
    } catch {
      setError(t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setError('');
    if (pwForm.next.length < 8) return setError(t('profile.passwordTooShort'));
    if (pwForm.next !== pwForm.confirm) return setError(t('profile.passwordMismatch'));
    setBusy(true);
    try {
      try {
        await reauthenticate(pwForm.current);
      } catch {
        setError(t('profile.currentPasswordWrong'));
        return;
      }
      await updatePassword(pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      setEditMode(null);
      showToast();
    } catch {
      setError(t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  const orNotProvided = (value) => (value && value.trim() ? value : t('profile.notProvided'));
  const fullName    = orNotProvided([user.firstName, user.lastName].filter(Boolean).join(' '));
  const fullPhone   = orNotProvided(user.phone ? `${user.phoneCode}${user.phone}` : '');
  const fullAddress = orNotProvided(
    [user.addressLine, user.city, [user.postal, user.state].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  );

  return (
    <div style={s.root}>
     

      {/* Right column */}
      <div style={s.rightCol}>
        {/* Scrollable content */}
        <div style={s.content}>
          <h1 style={s.pageTitle}>{t('profile.title')}</h1>

          {/* ── Personal Details card ── */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.cardLabel}>{t('profile.personalDetails')}</span>
              <button style={s.editBtn} onClick={openDetails}>
                <EditIcon /> {t('common.edit')}
              </button>
            </div>

            {editMode === 'details' ? (
              /* Edit form */
              <div style={s.form}>
                <div style={s.formGrid}>
                  <div style={s.field}>
                    <label style={s.label}>{t('profile.firstName')}</label>
                    <input style={s.input} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{t('profile.lastName')}</label>
                    <input style={s.input} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('profile.email')}</label>
                  <input style={{ ...s.input, opacity: 0.6, cursor: 'not-allowed' }} type="email" value={form.email} readOnly title={t('profile.emailLocked')} />
                  <span style={s.hint}>{t('profile.emailLocked')}</span>
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('profile.phoneNumber')}</label>
                  <div style={s.phoneRow}>
                    <select style={s.phoneCode} value={form.phoneCode} onChange={e => setForm({ ...form, phoneCode: e.target.value })}>
                      {['+60', '+62', '+673', '+65'].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input style={{ ...s.input, flex: 1 }} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('profile.address')} <span style={s.required}>*</span></label>
                  <p style={s.hint}>{t('profile.addressHint')}</p>
                  <input style={s.input} value={form.addressLine} onChange={e => setForm({ ...form, addressLine: e.target.value })} />
                </div>
                <div style={s.formGrid}>
                  <div style={s.field}>
                    <label style={s.label}>{t('profile.city')}</label>
                    <input style={s.input} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{t('profile.state')}</label>
                    <input style={s.input} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                  </div>
                </div>
                <div style={{ ...s.field, maxWidth: '200px' }}>
                  <label style={s.label}>{t('profile.postalCode')}</label>
                  <input style={s.input} value={form.postal} onChange={e => setForm({ ...form, postal: e.target.value })} />
                </div>
                {error && <p style={s.error} role="alert">{error}</p>}
                <div style={s.formActions}>
                  <button style={s.cancelBtn} onClick={closeEdit} disabled={busy}>{t('common.cancel')}</button>
                  <button style={s.saveBtn} onClick={saveDetails} disabled={busy}>{busy ? t('profile.saving') : t('profile.saveChanges')}</button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div style={s.detailsGrid}>
                {[
                  { label: t('profile.name'),    value: fullName },
                  { label: t('profile.email'),   value: user.email },
                  { label: t('profile.phone'),   value: fullPhone },
                  { label: t('profile.address'), value: fullAddress },
                ].map(row => (
                  <div key={row.label} style={s.detailRow}>
                    <span style={s.detailLabel}>{row.label}</span>
                    <span style={s.detailValue}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Password card ── */}
          <div style={{ ...s.card, marginTop: '16px' }}>
            <div style={s.cardHeader}>
              <span style={s.cardLabel}>{t('profile.password')}</span>
              <button style={s.editBtn} onClick={openPassword}>
                <EditIcon /> {t('common.edit')}
              </button>
            </div>

            {editMode === 'password' ? (
              <div style={s.form}>
                {[
                  { label: t('profile.currentPassword'), key: 'current' },
                  { label: t('profile.newPassword'),      key: 'next'    },
                  { label: t('profile.confirmPassword'),  key: 'confirm' },
                ].map(f => (
                  <div key={f.key} style={s.field}>
                    <label style={s.label}>{f.label}</label>
                    <input
                      style={s.input}
                      type="password"
                      value={pwForm[f.key]}
                      onChange={e => setPwForm({ ...pwForm, [f.key]: e.target.value })}
                    />
                  </div>
                ))}
                {error && <p style={s.error} role="alert">{error}</p>}
                <div style={s.formActions}>
                  <button style={s.cancelBtn} onClick={closeEdit} disabled={busy}>{t('common.cancel')}</button>
                  <button style={s.saveBtn} onClick={savePassword} disabled={busy}>{busy ? t('profile.saving') : t('profile.saveChanges')}</button>
                </div>
              </div>
            ) : (
              <div style={s.detailRow}>
                <span style={s.detailLabel}>{t('profile.password')}</span>
                <span style={{ ...s.detailValue, letterSpacing: '3px', fontSize: '18px' }}>••••••••</span>
              </div>
            )}
          </div>


        </div>
      </div>

      {/* ── Success toast overlay ── */}
      {toast && (
        <div style={s.toastOverlay}>
          <div style={s.toastBox}>
            <div style={s.toastIcon}>✓</div>
            <p style={s.toastText}>{t('profile.changesUpdated')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit icon ─────────────────────────────────────────────────────────────────
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ marginRight: 4, verticalAlign: 'middle' }}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
   root: {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    fontFamily: 'Inter, Arial, sans-serif',
    backgroundColor: 'var(--color-topbar-bg)',
  },
   sidebarWrap: {
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
  },
   rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
   content: {
    padding: '32px 40px 60px',
    boxSizing: 'border-box',
    maxWidth: '860px',
    width: '100%',
    margin: '0 auto',
  },

  pageTitle: { fontSize: '26px', fontWeight: '700', color: 'var(--color-ink)', marginBottom: '24px' },

  // Card
  card:       { backgroundColor: 'var(--color-card)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  cardLabel:  { fontSize: '16px', fontWeight: '700', color: 'var(--color-ink)' },

  editBtn: {
    display:         'flex', alignItems: 'center',
    gap:             '4px',
    background:      'none', border: '1px solid var(--color-border)',
    borderRadius:    '8px', padding: '5px 12px',
    fontSize:        '13px', fontWeight: '600',
    color:           'var(--color-ink)', cursor: 'pointer',
  },

  // View rows
  detailsGrid: { display: 'flex', flexDirection: 'column', gap: '0' },
  detailRow:   { display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'flex-start' },
  detailLabel: { minWidth: '90px', fontSize: '14px', fontWeight: '600', color: 'var(--color-ink)' },
  detailValue: { fontSize: '14px', color: 'var(--color-ink)', flex: 1 },

  // Edit form
  form:     { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  field:    { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:    { fontSize: '13px', fontWeight: '500', color: 'var(--color-ink)' },
  hint:     { fontSize: '11px', color: 'var(--color-faint)', margin: '-2px 0 0' },
  required: { color: 'var(--color-red)' },
  input: {
    padding: '10px 14px', borderRadius: '10px',
    border: '1px solid var(--color-border)', fontSize: '14px',
    outline: 'none', color: 'var(--color-ink)', backgroundColor: 'var(--color-card)',
    boxSizing: 'border-box', width: '100%',
  },
  phoneRow:  { display: 'flex', gap: '8px', alignItems: 'center' },
  error:     { fontSize: '13px', color: 'var(--color-red)', margin: '4px 0 0' },
  phoneCode: { padding: '10px 10px', borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--color-card)', cursor: 'pointer' },

  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' },
  cancelBtn: { padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-card)', fontSize: '14px', fontWeight: '600', color: 'var(--color-ink)', cursor: 'pointer' },
  saveBtn:   { padding: '10px 28px', borderRadius: '10px', border: 'none', background: '#d97706', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },


  // Toast
  toastOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toastBox:     { backgroundColor: 'var(--color-card)', borderRadius: '16px', padding: '36px 48px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', minWidth: '300px' },
  toastIcon:    { width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#22c55e', color: '#fff', fontSize: '24px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  toastText:    { fontSize: '18px', fontWeight: '600', color: 'var(--color-ink)', margin: 0 },
};
