import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { consumeFragmentToken, discardFragmentToken } from '../../auth/fragmentTokens';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { ApiClientError, authService } from '../../services/authService';
export default function VerifyEmailPage() {
  const [token] = useState(() => consumeFragmentToken('/verify-email'));
  const [state, setState] = useState(token ? 'working' : 'invalid');
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => () => { discardFragmentToken('/verify-email'); }, []);
  const verify = useCallback(async () => {
    if (!token) return;
    setState('working'); setError('');
    try {
      await authService.verifyEmail(token);
      setState('success');
    } catch (err) {
      if (err instanceof ApiClientError && [400, 422].includes(err.status)) setState('invalid');
      else { setError('Verification is temporarily unavailable. Please try again.'); setState('unavailable'); }
    }
  }, [token]);
  useEffect(() => { if (token && !started.current) { started.current = true; void verify(); } }, [token, verify]);
  return <AuthLayout minimal><AuthCard><h1>Verify email</h1>{state === 'working' && <p>Verifying your email…</p>}{state === 'success' && <p>Your account is active. <Link to="/login">Sign in</Link>.</p>}{state === 'invalid' && <p role="alert">This verification link is invalid, expired, or has already been used. <Link to="/check-email">Request another email</Link>.</p>}{state === 'unavailable' && <div><p role="alert">{error}</p><button type="button" onClick={() => void verify()}>Try again</button></div>}</AuthCard></AuthLayout>;
}
