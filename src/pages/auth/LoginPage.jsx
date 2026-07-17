import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// Real Supabase email + password sign-in. On success we return the user to
// wherever a ProtectedRoute/RequireAdmin bounced them from (location.state.from).
const LoginPage = () => {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t('auth.enterEmailPassword'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message || t('auth.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>{t('auth.loginTitle')}</h1>
        <p style={styles.subtitle}>
          {t('auth.noAccountYet')} <Link to="/register" style={styles.link}>{t('auth.registerNow')}</Link>
        </p>

        <form onSubmit={handleSubmit}>
          <Field label={t('profile.email')} required>
            <TextInput
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
            />
          </Field>

          <Field label={t('profile.password')} required>
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
            />
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" disabled={busy} style={styles.submitBtn}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
        </form>

        <Link to="/forgot-password" style={styles.forgotLink}>
          {t('auth.forgottenPassword')}
        </Link>
      </AuthCard>
    </AuthLayout>
  );
};

const styles = {
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 28px', fontFamily: FONT },
  link: { color: COLORS.ink, fontWeight: 700, textDecoration: 'underline' },
  error: { fontSize: 13.5, color: COLORS.red, margin: '-8px 0 14px', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 8 },
  forgotLink: {
    display: 'block',
    textAlign: 'center',
    marginTop: 22,
    fontSize: 13.5,
    color: COLORS.muted,
    textDecoration: 'underline',
    fontFamily: FONT,
  },
};

export default LoginPage;
