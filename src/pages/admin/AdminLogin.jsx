import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAuthEnabled, signIn } from '../../services/authService';
import './adminLogin.css';

/**
 * Admin sign-in for the News Tracker review queue.
 *  • Supabase configured → email + password via Supabase Auth, then redirect to
 *    the queue (or wherever the gate sent us from).
 *  • Not configured (mock mode) → there is no login; redirect straight through.
 */
const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/admin/news';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Mock mode has no auth — go straight to the queue.
  useEffect(() => {
    if (!isAuthEnabled) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError.message || 'Sign in failed. Check your email and password.');
      setBusy(false);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1 className="admin-login-title">Admin sign in</h1>
        <p className="admin-login-subtitle">
          Sign in to review and publish News Tracker drafts.
        </p>

        <div className="admin-login-field">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="admin-login-field">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="admin-login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="admin-login-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
