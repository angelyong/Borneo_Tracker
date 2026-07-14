import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { authService } from '../../services/authService';
import { COLORS, FONT } from '../../theme';

const EMPTY = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };
export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setFieldErrors({});
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await authService.register({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName });
      navigate('/check-email', { replace: true, state: { purpose: 'verify', email: form.email, cooldown: 60 } });
    } catch (err) { setError(err.message); setFieldErrors(err.fieldErrors || {}); } finally { setBusy(false); }
  };
  return <AuthLayout><AuthCard>
    <h1 style={styles.title}>Create your account</h1>
    <p style={styles.subtitle}>Already have an account? <Link to="/login" style={styles.link}>Login.</Link></p>
    <form onSubmit={submit}>
      <div style={styles.row}>
        <Field label="First name" required style={styles.rowField}><TextInput maxLength={100} autoComplete="given-name" value={form.firstName} onChange={field('firstName')} aria-invalid={Boolean(fieldErrors.firstName)} required />{fieldErrors.firstName && <p role="alert" style={styles.fieldError}>{fieldErrors.firstName}</p>}</Field>
        <Field label="Last name" required style={styles.rowField}><TextInput maxLength={100} autoComplete="family-name" value={form.lastName} onChange={field('lastName')} aria-invalid={Boolean(fieldErrors.lastName)} required />{fieldErrors.lastName && <p role="alert" style={styles.fieldError}>{fieldErrors.lastName}</p>}</Field>
      </div>
      <Field label="Email" required><TextInput type="email" maxLength={254} autoComplete="email" value={form.email} onChange={field('email')} aria-invalid={Boolean(fieldErrors.email)} required />{fieldErrors.email && <p role="alert" style={styles.fieldError}>{fieldErrors.email}</p>}</Field>
      <Field label="Password" required hint="At least 12 characters"><PasswordInput maxLength={128} autoComplete="new-password" value={form.password} onChange={field('password')} aria-invalid={Boolean(fieldErrors.password)} required />{fieldErrors.password && <p role="alert" style={styles.fieldError}>{fieldErrors.password}</p>}</Field>
      <Field label="Confirm password" required><PasswordInput maxLength={128} autoComplete="new-password" value={form.confirmPassword} onChange={field('confirmPassword')} aria-invalid={Boolean(fieldErrors.confirmPassword)} required />{fieldErrors.confirmPassword && <p role="alert" style={styles.fieldError}>{fieldErrors.confirmPassword}</p>}</Field>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      <Button type="submit" disabled={busy} style={styles.submitBtn}>{busy ? 'Creating account…' : 'Register'}</Button>
    </form>
  </AuthCard></AuthLayout>;
}
const styles = {
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 8px', fontFamily: FONT },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 28px', fontFamily: FONT }, link: { color: COLORS.ink, fontWeight: 700, textDecoration: 'underline' },
  row: { display: 'flex', gap: 16 }, rowField: { flex: 1 }, error: { fontSize: 13.5, color: COLORS.red, margin: '-8px 0 14px' }, fieldError: { fontSize: 12.5, color: COLORS.red, margin: '5px 0 0' }, submitBtn: { width: '100%', marginTop: 8 },
};
