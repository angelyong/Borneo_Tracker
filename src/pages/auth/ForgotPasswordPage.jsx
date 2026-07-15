import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Icons, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// Real Supabase password-reset request. Supabase emails a recovery link that
// redirects back to /reset-password; we always show the neutral "check your
// email" screen so the form never reveals whether an account exists.
const ForgotPasswordPage = () => {
  const { resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email address you signed up with.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await resetPasswordForEmail(email.trim());
      navigate('/check-email', { replace: true, state: { purpose: 'reset', email: email.trim() } });
    } catch (err) {
      setError(err.message || 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => navigate('/login')}
          aria-label="Close"
          style={styles.closeBtn}
        >
          <Icons.Close size={20} color={COLORS.ink} />
        </button>

        <h1 style={styles.title}>Find your account</h1>
        <p style={styles.subtitle}>
          Please enter the email address you signed up with and we&rsquo;ll send you a link to reset
          your password by email.
        </p>

        <form onSubmit={handleSubmit}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="navy" disabled={busy} style={styles.submitBtn}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

const styles = {
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    border: 'none',
    background: 'transparent',
    padding: 4,
    cursor: 'pointer',
    color: COLORS.ink,
  },
  title: { fontSize: 22, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 12px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5, fontFamily: FONT },
  input: { background: '#F3F4F6', border: 'none', textAlign: 'center' },
  error: { fontSize: 13.5, color: COLORS.red, textAlign: 'center', margin: '10px 0 0', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 20 },
};

export default ForgotPasswordPage;
