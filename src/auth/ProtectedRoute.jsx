import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

const Centered = ({ children, ...rest }) => (
  <div style={{ padding: 40, textAlign: 'center' }} {...rest}>
    {children}
  </div>
);

// Shown instead of the page when an admin has suspended this account. Says which
// state the account is in rather than a generic denial, so the person knows to
// ask an administrator instead of retrying.
const Suspended = () => (
  <Centered role="alert">
    This account has been suspended. Please contact an administrator.
  </Centered>
);

/** Requires a signed-in user; otherwise bounces to /login (remembering where). */
export const ProtectedRoute = ({ children }) => {
  const { loading, isAuthenticated, isSuspended } = useAuth();
  const location = useLocation();
  if (loading) return <Centered>Checking your session…</Centered>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (isSuspended) return <Suspended />;
  return children;
};

/** Requires a signed-in, non-suspended user whose profile role is 'admin'. */
export const RequireAdmin = ({ children }) => {
  const { loading, isAuthenticated, isAdmin, isSuspended } = useAuth();
  const location = useLocation();
  if (loading) return <Centered>Checking your session…</Centered>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  // Checked before isAdmin so a suspended admin gets the accurate reason.
  if (isSuspended) return <Suspended />;
  if (!isAdmin) {
    return <Centered role="alert">You do not have permission to view this page.</Centered>;
  }
  return children;
};

/** For /login, /register — redirect already-signed-in users to home. */
export const GuestOnlyRoute = ({ children }) => {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <Centered>Loading…</Centered>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};
