import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// Shown after register (verify a new account) or forgot-password (reset link).
// Lets the user resend the email, with a cooldown so we don't spam Supabase's
// rate-limited mailer.
const CheckEmailPage = () => {
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
      setError('Enter your email address.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (purpose === 'reset') await resetPasswordForEmail(email.trim());
      else await resendSignup(email.trim());
      setMessage('Email sent. Please check your inbox (and spam folder).');
      setCooldown(purpose === 'verify' ? 60 : 30);
    } catch (err) {
      setError(err.message || 'Could not send the email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>Check your email</h1>
        <p style={styles.subtitle}>
          {purpose === 'reset'
            ? 'If an account matches, we sent a password reset link.'
            : 'We sent a verification link to your email. Click it to activate your account.'}
        </p>

        <form onSubmit={resend}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
          />

          {message && <p style={styles.ok}>{message}</p>}
          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" disabled={busy || cooldown > 0} style={styles.submitBtn}>
            {busy ? 'Sending…' : cooldown ? `Send again in ${cooldown}s` : 'Send another email'}
          </Button>
        </form>

        <Link to="/login" style={styles.link}>Back to login</Link>
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
