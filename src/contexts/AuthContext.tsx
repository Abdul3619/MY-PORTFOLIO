import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // True when the session came from a password-reset email link (the user can set a new password without the old one)
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isPasswordRecovery: false,
  clearPasswordRecovery: () => {},
  signOut: async () => {},
});

const RECOVERY_KEY = 'admin_password_recovery';

function readRecoveryFlag() {
  try {
    return window.sessionStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
}

function writeRecoveryFlag(active: boolean) {
  try {
    if (active) window.sessionStorage.setItem(RECOVERY_KEY, '1');
    else window.sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Storage unavailable; the flag then only lasts until the next reload
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const setRecovery = (active: boolean) => {
    writeRecoveryFlag(active);
    setIsPasswordRecovery(active);
  };

  useEffect(() => {
    // A reset link may have been opened earlier in this tab (the flag survives the redirect below)
    if (readRecoveryFlag()) setIsPasswordRecovery(true);

    // Get initial session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem('sb_access_token', session.access_token);
      } else {
        localStorage.removeItem('sb_access_token');
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        // Reset links can land on any page (Supabase falls back to the Site URL); send the owner to the password form
        if (window.location.pathname !== '/admin/account') {
          window.location.assign('/admin/account');
        }
      }
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem('sb_access_token', session.access_token);
      } else {
        localStorage.removeItem('sb_access_token');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, isPasswordRecovery, clearPasswordRecovery: () => setRecovery(false), signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
