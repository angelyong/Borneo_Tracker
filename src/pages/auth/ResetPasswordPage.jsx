import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, SuccessModal } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// Reached from the Supabase recovery link. Opening that link establishes a
// short-lived recovery session (handled by AuthProvider's onAuthStateChange),
// so updateUser({ password }) here sets the new password. We then sign out and
// send the user to a clean login.
const ResetPasswordPage = () => {
  const { updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await updatePassword(password);
      await signOut();
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Could not reset the password. Open the reset link from your email again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>Reset Password</h1>

        <form onSubmit={handleSubmit}>
          <Field label="New Password" hint="At least 12 characters">
            <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" />
          </Field>

          <Field label="Confirm Password">
            <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" />
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" disabled={busy} style={styles.submitBtn}>
            {busy ? 'Resetting…' : 'Submit'}
          </Button>
        </form>
      </AuthCard>

      <SuccessModal open={done} message="Your password has been reset." />
    </AuthLayout>
  );
};

const styles = {
  title: { fontSize: 24, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 26px', fontFamily: FONT },
  error: { fontSize: 13.5, color: COLORS.red, margin: '-8px 0 14px', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 8 },
};

export default ResetPasswordPage;
