import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { Button, TextInput } from '../../components/ui';
import { authService } from '../../services/authService';

export default function CheckEmailPage() {
  const location = useLocation();
  const purpose = location.state?.purpose === 'reset' ? 'reset' : 'verify';
  const [email, setEmail] = useState(location.state?.email || '');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(location.state?.cooldown || 0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setFieldErrors({}); setMessage('');
    try {
      const result = purpose === 'reset'
        ? await authService.forgotPassword(email)
        : await authService.resendVerification(email);
      setMessage(result.message);
      setCooldown(purpose === 'verify' ? 60 : 30);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setBusy(false);
    }
  };

  return <AuthLayout><AuthCard>
    <h1>Check your email</h1>
    <p>{purpose === 'reset' ? 'If an account matches, we sent a password reset link.' : 'If the address can be registered, we sent a verification link.'}</p>
    <form onSubmit={resend}>
      <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" aria-label="Email address" aria-invalid={Boolean(fieldErrors.email)} required />
      {fieldErrors.email && <p role="alert" style={{ color: '#b91c1c' }}>{fieldErrors.email}</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <Button type="submit" disabled={busy || cooldown > 0} style={{ width: '100%', marginTop: 14 }}>
        {busy ? 'Sending…' : cooldown ? `Send again in ${cooldown}s` : 'Send another email'}
      </Button>
    </form>
    {import.meta.env.DEV && <p>Local development inbox: <a href="http://localhost:8025" target="_blank" rel="noreferrer">Mailpit</a>.</p>}
    <Link to="/login">Back to login</Link>
  </AuthCard></AuthLayout>;
}
