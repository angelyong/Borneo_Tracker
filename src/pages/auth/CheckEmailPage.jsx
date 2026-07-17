import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// Shown after register (verify a new account) or forgot-password (reset link).
// Lets the user resend the email, with a cooldown so we don't spam Supabase's
// rate-limited mailer.
const CheckEmailPage = () => {
  const { t } = useTranslation();
  const { resendSignup, resetPasswordForEmail } = useAuth();
  const location = useLocation();
  const purpose = location.state?.purpose === 'reset' ? 'reset' : 'verify';
  const [email, setEmail] = useState(location.state?.email || '');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(location.state?.cooldown || 0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('auth.enterEmailAddress'));
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (purpose === 'reset') await resetPasswordForEmail(email.trim());
      else await resendSignup(email.trim());
      setMessage(t('auth.emailSentNotice'));
      setCooldown(purpose === 'verify' ? 60 : 30);
    } catch (err) {
      setError(err.message || t('auth.couldNotSendEmail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>{t('auth.checkEmailTitle')}</h1>
        <p style={styles.subtitle}>
          {purpose === 'reset'
            ? t('auth.resetEmailSentNotice')
            : t('auth.verifyEmailSentNotice')}
        </p>

        <form onSubmit={resend}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailAddressPlaceholder')}
            aria-label={t('auth.emailAddressPlaceholder')}
          />

          {message && <p style={styles.ok}>{message}</p>}
          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" disabled={busy || cooldown > 0} style={styles.submitBtn}>
            {busy ? t('auth.sending') : cooldown ? t('auth.sendAgainIn', { seconds: cooldown }) : t('auth.sendAnotherEmail')}
          </Button>
        </form>

        <Link to="/login" style={styles.link}>{t('auth.backToLogin')}</Link>
      </AuthCard>
    </AuthLayout>
  );
};

const styles = {
  title: { fontSize: 24, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 12px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 22px', lineHeight: 1.5, fontFamily: FONT },
  ok: { fontSize: 13.5, color: COLORS.green, textAlign: 'center', margin: '12px 0 0', fontFamily: FONT },
  error: { fontSize: 13.5, color: COLORS.red, textAlign: 'center', margin: '12px 0 0', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 16 },
  link: {
    display: 'block',
    textAlign: 'center',
    marginTop: 22,
    fontSize: 13.5,
    color: COLORS.muted,
    textDecoration: 'underline',
    fontFamily: FONT,
  },
};

export default CheckEmailPage;
