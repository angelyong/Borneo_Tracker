import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { consumeFragmentToken, discardFragmentToken } from '../../auth/fragmentTokens';
import { useAuth } from '../../auth/useAuth';
import AuthLayout, { AuthCard } from '../../components/AuthLayout';
import { authService } from '../../services/authService';

const Shell = ({ children }) => <AuthLayout minimal><AuthCard><h1>Confirm email change</h1>{children}</AuthCard></AuthLayout>;

export default function ConfirmEmailChangePage() {
  const { status, updateUser, refresh } = useAuth();
  if (status === 'loading') return <Shell><p>Checking your session…</p></Shell>;
  if (status === 'unavailable') return <Shell><p>Authentication is temporarily unavailable.</p><button type="button" onClick={() => void refresh()}>Try again</button></Shell>;
  return <ResolvedConfirmation key={status} status={status} updateUser={updateUser} />;
}

function ResolvedConfirmation({ status, updateUser }) {
  const [{ token, requiresReopen }] = useState(() => {
    const captured = consumeFragmentToken('/confirm-email-change');
    if (status === 'anonymous' && captured) {
      discardFragmentToken('/confirm-email-change');
      return { token: null, requiresReopen: true };
    }
    return { token: captured, requiresReopen: false };
  });
  const [result, setResult] = useState('waiting');
  const started = useRef(false);

  useEffect(() => () => { discardFragmentToken('/confirm-email-change'); }, []);
  const confirm = useCallback(async () => {
    if (!token) return;
    setResult('working');
    try {
      const data = await authService.confirmEmailChange(token);
      updateUser(data.user);
      setResult('success');
    } catch (error) {
      setResult(error?.status >= 500 || error?.status === 429 || !error?.status ? 'unavailable' : error.message);
    }
  }, [token, updateUser]);
  useEffect(() => {
    if (status === 'authenticated' && token && !started.current) {
      started.current = true;
      void confirm();
    }
  }, [status, token, confirm]);

  let content = <p>Checking your session…</p>;
  if (requiresReopen) content = <p>Please <Link to="/login">sign in with your current email</Link>, then reopen the original email link.</p>;
  else if (!token) content = <p role="alert">This confirmation link is missing or has already been opened.</p>;
  else if (result === 'working') content = <p>Confirming your new email…</p>;
  else if (result === 'success') content = <p>Your sign-in email has been changed.</p>;
  else if (result === 'unavailable') content = <div><p role="alert">Email confirmation is temporarily unavailable.</p><button type="button" onClick={() => void confirm()}>Try again</button></div>;
  else if (result !== 'waiting') content = <p role="alert">{result}</p>;
  return <Shell>{content}</Shell>;
}
