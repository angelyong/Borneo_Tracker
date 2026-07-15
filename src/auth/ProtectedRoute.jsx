import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

const Centered = ({ children, ...rest }) => (
  <div style={{ padding: 40, textAlign: 'center' }} {...rest}>
    {children}
  </div>
);

/** Requires a signed-in user; otherwise bounces to /login (remembering where). */
export const ProtectedRoute = ({ children }) => {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <Centered>Checking your session…</Centered>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

/** Requires a signed-in user whose profile role is 'admin'. */
export const RequireAdmin = ({ children }) => {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Centered>Checking your session…</Centered>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
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
