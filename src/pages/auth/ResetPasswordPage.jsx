import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { consumeFragmentToken, discardFragmentToken } from '../../auth/fragmentTokens';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput } from '../../components/ui';
import { authService } from '../../services/authService';
import { COLORS } from '../../theme';

export default function ResetPasswordPage() {
  const [token] = useState(() => consumeFragmentToken('/reset-password'));
  useEffect(() => () => { discardFragmentToken('/reset-password'); }, []);
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(token ? '' : 'This reset link is missing or has already been opened.'); const [fieldErrors, setFieldErrors] = useState({}); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); if (!token) return; setError(''); setFieldErrors({}); setBusy(true); try { await authService.resetPassword(token, password, confirm); setDone(true); } catch (err) { setError(err.message); setFieldErrors(err.fieldErrors || {}); } finally { setBusy(false); } };
  return <AuthLayout minimal><AuthCard><h1 style={styles.title}>Reset Password</h1>
    {done ? <p role="status">Your password has been reset. <Link to="/login">Sign in</Link>.</p> : <form onSubmit={submit}>
      <Field label="New Password" hint="At least 12 characters"><PasswordInput maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErrors.password)} required />{fieldErrors.password && <p role="alert" style={styles.fieldError}>{fieldErrors.password}</p>}</Field>
      <Field label="Confirm Password"><PasswordInput maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={Boolean(fieldErrors.confirmPassword)} required />{fieldErrors.confirmPassword && <p role="alert" style={styles.fieldError}>{fieldErrors.confirmPassword}</p>}</Field>
      {error && <p role="alert" style={styles.error}>{error}</p>}<Button type="submit" disabled={busy || !token} style={{ width: '100%' }}>{busy ? 'Resetting…' : 'Reset password'}</Button>
      {!token && <p><Link to="/forgot-password">Request a new reset link</Link></p>}
    </form>}
  </AuthCard></AuthLayout>;
}
const styles = { title: { fontSize: 24, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 26px' }, error: { color: COLORS.red, fontSize: 13.5 }, fieldError: { color: COLORS.red, fontSize: 12.5, margin: '5px 0 0' } };
