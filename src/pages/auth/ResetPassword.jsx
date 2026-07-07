import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../theme';
import { Button, Field, PasswordInput, SuccessModal } from '../../components/ui';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    resetPassword(email, password);
    setDone(true);
    setTimeout(() => navigate('/login'), 1500);
  };

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '34px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 18 }}>
          Reset Password
        </h1>
        <form
          onSubmit={submit}
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 2px 12px rgba(15,42,30,0.08)',
            padding: '28px 30px',
          }}
        >
          <Field label="New Password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm Password">
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error && (
            <div style={{ color: COLORS.red, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <Button type="submit" style={{ width: '100%', marginTop: 4 }}>
            Submit
          </Button>
        </form>
      </div>
      <SuccessModal open={done} message="Password updated successfully." />
    </Layout>
  );
}
