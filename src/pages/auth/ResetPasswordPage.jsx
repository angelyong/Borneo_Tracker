import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, SuccessModal } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setDone(true);
    setTimeout(() => navigate('/login'), 2000);
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>Reset Password</h1>

        <form onSubmit={handleSubmit}>
          <Field label="New Password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter new password" />
          </Field>

          <Field label="Confirm Password">
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" />
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" style={styles.submitBtn}>
            Submit
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
