import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { COLORS, FONT } from '../../theme';

const ALLOWED_RETURN_ROUTES = new Set(['/profile', '/community', '/admin/news', '/incident_report']);
const safeReturnTo = (value) => ALLOWED_RETURN_ROUTES.has(value) ? value : '/';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault(); setError(''); setFieldErrors({}); setBusy(true);
    try {
      await login({ email, password });
      navigate(safeReturnTo(location.state?.from), { replace: true });
    } catch (err) { setError(err.message); setFieldErrors(err.fieldErrors || {}); } finally { setBusy(false); }
  };
  return <AuthLayout><AuthCard>
    <h1 style={styles.title}>Login</h1>
    <p style={styles.subtitle}>Don&rsquo;t have an account? <Link to="/register" style={styles.link}>Register now.</Link></p>
    <form onSubmit={handleSubmit}>
      <Field label="Email" required><TextInput type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fieldErrors.email)} required />{fieldErrors.email && <p role="alert" style={styles.fieldError}>{fieldErrors.email}</p>}</Field>
      <Field label="Password" required><PasswordInput autoComplete="current-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErrors.password)} required />{fieldErrors.password && <p role="alert" style={styles.fieldError}>{fieldErrors.password}</p>}</Field>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      <Button type="submit" disabled={busy} style={styles.submitBtn}>{busy ? 'Signing in…' : 'Sign In'}</Button>
    </form>
    <Link to="/forgot-password" style={styles.forgotLink}>Forgotten your password?</Link>
  </AuthCard></AuthLayout>;
}

const styles = {
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 28px', fontFamily: FONT },
  link: { color: COLORS.ink, fontWeight: 700, textDecoration: 'underline' },
  error: { fontSize: 13.5, color: COLORS.red, margin: '-8px 0 14px', fontFamily: FONT },
  fieldError: { fontSize: 12.5, color: COLORS.red, margin: '5px 0 0', fontFamily: FONT },
  submitBtn: { width: '100%', marginTop: 8 },
  forgotLink: { display: 'block', textAlign: 'center', marginTop: 22, fontSize: 13.5, color: COLORS.muted, textDecoration: 'underline', fontFamily: FONT },
};
