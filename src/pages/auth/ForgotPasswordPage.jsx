import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Icons, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// Real Supabase password-reset request. Supabase emails a recovery link that
// redirects back to /reset-password; we always show the neutral "check your
// email" screen so the form never reveals whether an account exists.
const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const { resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('auth.enterSignupEmail'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await resetPasswordForEmail(email.trim());
      navigate('/check-email', { replace: true, state: { purpose: 'reset', email: email.trim() } });
    } catch (err) {
      setError(err.message || t('auth.couldNotSendReset'));
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
          aria-label={t('common.close')}
          style={styles.closeBtn}
        >
          <Icons.Close size={20} color={COLORS.ink} />
        </button>

        <h1 style={styles.title}>{t('auth.findAccountTitle')}</h1>
        <p style={styles.subtitle}>
          {t('auth.findAccountBody')}
        </p>

        <form onSubmit={handleSubmit}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailAddressPlaceholder')}
            aria-label={t('auth.emailAddressPlaceholder')}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="navy" disabled={busy} style={styles.submitBtn}>
            {busy ? t('auth.submitting') : t('auth.submit')}
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
