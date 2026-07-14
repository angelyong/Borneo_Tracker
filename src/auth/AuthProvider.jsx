import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError, authService, bootstrapCsrf, subscribeAuthRecheck, subscribeSessionInvalid } from '../services/authService';
import { AuthContext } from './authContext';

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const refreshPromise = useRef(null);

  const refresh = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current;
    setStatus('loading');
    const pending = (async () => {
      try {
        await bootstrapCsrf();
        const result = await authService.me();
        setUser(result.user);
        setStatus('authenticated');
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          authService.clearMemory();
          setUser(null);
          setStatus('anonymous');
        } else {
          setStatus('unavailable');
        }
      } finally {
        refreshPromise.current = null;
      }
    })();
    refreshPromise.current = pending;
    return pending;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const clearInvalidSession = () => {
      authService.clearMemory();
      setUser(null);
      setStatus('anonymous');
    };
    const unsubscribeInvalid = subscribeSessionInvalid(clearInvalidSession);
    const unsubscribeRecheck = subscribeAuthRecheck(() => void refresh());
    return () => { unsubscribeInvalid(); unsubscribeRecheck(); };
  }, [refresh]);

  const login = useCallback(async (input) => {
    const result = await authService.login(input);
    setUser(result.user);
    setStatus('authenticated');
    return result;
  }, []);
  const logout = useCallback(async () => {
    try {
      await authService.logout();
      authService.clearMemory();
      setUser(null);
      setStatus('anonymous');
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'SESSION_INVALID') {
        authService.clearMemory();
        setUser(null);
        setStatus('anonymous');
        return;
      }
      setStatus('unavailable');
      throw error;
    }
  }, []);
  const updateUser = useCallback((next) => { setUser(next); setStatus(next ? 'authenticated' : 'anonymous'); }, []);
  const value = useMemo(() => ({ status, user, refresh, login, logout, updateUser }), [status, user, refresh, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
