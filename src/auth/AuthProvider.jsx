import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }){
  // undefined = todavía no sabemos (cargando), null = sin sesión
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback((email, password) =>
    supabase.auth.signInWithPassword({ email, password }), []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const requestPasswordReset = useCallback((email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }), []);

  const updatePassword = useCallback(async (password) => {
    const res = await supabase.auth.updateUser({ password });
    if (!res.error) setRecovery(false);
    return res;
  }, []);

  const value = {
    session,
    loading: session === undefined,
    recovery,
    signIn, signOut, requestPasswordReset, updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
