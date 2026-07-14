import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export const ProtectedRoute = ({ children }) => {
  const { status, refresh } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>Checking your session…</div>;
  if (status === 'unavailable') return <div style={{ padding: 40, textAlign: 'center' }}>Authentication is temporarily unavailable. <button onClick={refresh}>Try again</button></div>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
};

export const GuestOnlyRoute = ({ children }) => {
  const { status, refresh } = useAuth();
  if (status === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (status === 'unavailable') return <div style={{ padding: 40, textAlign: 'center' }}>Authentication is temporarily unavailable. <button onClick={refresh}>Try again</button></div>;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return children;
};

export const AdminRoute = ({ children }) => {
  const { status, user, refresh } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>Checking your session…</div>;
  if (status === 'unavailable') return <div style={{ padding: 40, textAlign: 'center' }}>Authentication is temporarily unavailable. <button onClick={refresh}>Try again</button></div>;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user?.role !== 'ADMIN') return <div role="alert" style={{ padding: 40, textAlign: 'center' }}>You do not have permission to view this page.</div>;
  return children;
};
