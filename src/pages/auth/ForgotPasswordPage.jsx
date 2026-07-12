import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Icons, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// No email service exists in this app, so there's nothing to actually send.
// Submitting takes you straight to Reset Password — standing in for "the
// user clicked the link we would have emailed them."
const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email address you signed up with.');
      return;
    }
    navigate('/reset-password');
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="navy" style={styles.submitBtn}>
            Submit
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
