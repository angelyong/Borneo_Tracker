import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

// There's no backend anywhere in this app yet (see sidebar/MiniTopBar logout,
// which clears an authToken that was never actually set). Signing in just
// validates the fields and sets that same token, so logout finally has
// something real to undo — it does not check credentials against anything.
const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to sign in.');
      return;
    }
    localStorage.setItem('authToken', 'demo-session');
    navigate('/');
  };

  return (
    <AuthLayout>
      <AuthCard>
        <h1 style={styles.title}>Login</h1>
        <p style={styles.subtitle}>
          Don&rsquo;t have any account? <Link to="/register" style={styles.link}>Register now.</Link>
        </p>

        <form onSubmit={handleSubmit}>
          <Field label="Email" required>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" required>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" style={styles.submitBtn}>
            Sign In
          </Button>
        </form>

        <Link to="/forgot-password" style={styles.forgotLink}>
          Forgotten your password?
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
