import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', confirm: '' };

// Real Supabase sign-up. First/last name ride along in user metadata; a DB
// trigger (handle_new_user) turns that into a public.profiles row. Email
// verification is ON, so we send the user to /check-email afterwards.
const RegisterPage = () => {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) {
      setError(t('auth.fillEveryField'));
      return;
    }
    if (form.password.length < 12) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (form.password !== form.confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      navigate('/check-email', {
        replace: true,
        state: { purpose: 'verify', email: form.email.trim(), cooldown: 60 },
      });
    } catch (err) {
      setError(err.message || t('auth.couldNotCreateAccount'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>{t('auth.createAccountTitle')}</h1>
        <p style={styles.subtitle}>
          {t('auth.alreadyHaveAccount')} <Link to="/login" style={styles.link}>{t('auth.loginLink')}</Link>
        </p>

        <form onSubmit={handleSubmit}>
          <div style={styles.row}>
            <Field label={t('profile.firstName')} required style={styles.rowField}>
              <TextInput autoComplete="given-name" value={form.firstName} onChange={setField('firstName')} placeholder="Json" />
            </Field>
            <Field label={t('profile.lastName')} required style={styles.rowField}>
              <TextInput autoComplete="family-name" value={form.lastName} onChange={setField('lastName')} placeholder="Chen" />
            </Field>
          </div>

          <Field label={t('profile.email')} required>
            <TextInput type="email" autoComplete="email" value={form.email} onChange={setField('email')} placeholder={t('auth.emailPlaceholder')} />
          </Field>

          <Field label={t('profile.password')} required hint={t('auth.atLeast12Chars')}>
            <PasswordInput autoComplete="new-password" value={form.password} onChange={setField('password')} placeholder={t('auth.createPasswordPlaceholder')} />
          </Field>

          <Field label={t('profile.confirmPassword')} required>
            <PasswordInput autoComplete="new-password" value={form.confirm} onChange={setField('confirm')} placeholder={t('auth.reenterPasswordPlaceholder')} />
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" disabled={busy} style={styles.submitBtn}>
            {busy ? t('auth.creatingAccount') : t('auth.register')}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

const styles = {
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 28px', fontFamily: FONT },
  link: { color: COLORS.ink, fontWeight: 700, textDecoration: 'underline' },
  row: { display: 'flex', gap: 16 },
  rowField: { flex: 1 },
  error: { fontSize: 13.5, color: COLORS.red, margin: '-8px 0 14px', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 8 },
};

export default RegisterPage;
