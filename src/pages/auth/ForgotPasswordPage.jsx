import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, Icons, TextInput } from '../../components/ui';
import { authService } from '../../services/authService';
import { COLORS, FONT } from '../../theme';

export default function ForgotPasswordPage() {
  const navigate = useNavigate(); const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [fieldErrors, setFieldErrors] = useState({}); const [busy, setBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); setError(''); setFieldErrors({}); setBusy(true); try { await authService.forgotPassword(email); navigate('/check-email', { replace: true, state: { purpose: 'reset', email } }); } catch (err) { setError(err.message); setFieldErrors(err.fieldErrors || {}); } finally { setBusy(false); } };
  return <AuthLayout><AuthCard style={{ position: 'relative' }}>
    <button type="button" onClick={() => navigate('/login')} aria-label="Close" style={styles.closeBtn}><Icons.Close size={20} color={COLORS.ink} /></button>
    <h1 style={styles.title}>Find your account</h1>
    <p style={styles.subtitle}>Enter your email and we&rsquo;ll send a password reset link if an account matches.</p>
    <form onSubmit={submit}>
      <TextInput type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" aria-invalid={Boolean(fieldErrors.email)} required style={styles.input} />
      {fieldErrors.email && <p role="alert" style={styles.error}>{fieldErrors.email}</p>}
      {error && <p role="alert" style={styles.error}>{error}</p>}
      <Button type="submit" variant="navy" disabled={busy} style={styles.submitBtn}>{busy ? 'Submitting…' : 'Submit'}</Button>
    </form>
  </AuthCard></AuthLayout>;
}
const styles = { closeBtn: { position: 'absolute', top: 20, right: 20, border: 'none', background: 'transparent', padding: 4 }, title: { fontSize: 22, fontWeight: 800, color: COLORS.ink, textAlign: 'center', margin: '0 0 12px', fontFamily: FONT }, subtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }, input: { background: '#F3F4F6', border: 'none', textAlign: 'center' }, error: { fontSize: 13.5, color: COLORS.red, textAlign: 'center' }, submitBtn: { width: '100%', marginTop: 20 } };
