import { useContext } from 'react';
import { AuthContext } from './authContext';

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
};
