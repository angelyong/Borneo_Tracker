import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { AuthContext } from './authContext';

// When Supabase keys are absent (a clone with no .env, or the vitest suite) there
// is no real auth: we fall back to a mock "signed-in admin" so the admin pages
// and protected routes still render with zero setup — mirroring the previous
// authService mock-mode behaviour.
const MOCK = !isSupabaseConfigured;

/**
 * Unified Supabase auth for BOTH end users and admins.
 * `role` comes from public.profiles (default 'user'; 'admin' set by an operator).
 * Exposes: loading, session, user, profile, role, isAdmin, isAuthenticated,
 * and the actions signIn / signUp / signOut / resetPasswordForEmail /
 * resendSignup / updatePassword / refreshProfile.
 */
export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(!MOCK);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, status')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
  }, []);

  // Hydrate the current session, then keep it in sync (login / logout / token
  // refresh / password-recovery all arrive through onAuthStateChange).
  useEffect(() => {
    if (MOCK) return undefined;
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      await loadProfile(next?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async ({ email, password, firstName, lastName }) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const resetPasswordForEmail = useCallback(async (email) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const resendSignup = useCallback(async (email) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    const role = MOCK ? 'admin' : profile?.role ?? 'user';
    return {
      loading,
      isAuthEnabled: !MOCK,
      session,
      user,
      profile,
      role,
      isAdmin: role === 'admin',
      isAuthenticated: MOCK ? true : Boolean(session),
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      resendSignup,
      updatePassword,
      refreshProfile: () => loadProfile(user?.id),
    };
  }, [
    loading,
    session,
    profile,
    signIn,
    signUp,
    signOut,
    resetPasswordForEmail,
    resendSignup,
    updatePassword,
    loadProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
