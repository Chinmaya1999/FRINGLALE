'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const router = useRouter();
  const path = usePathname();

  const refreshCart = useCallback(async () => {
    if (!getToken()) return setCartCount(0);
    try { const c = await api('/cart'); setCartCount(c.items.reduce((s, i) => s + i.qty, 0)); } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try { setUser((await api('/auth/me')).user); await refreshCart(); } catch { setToken(null); }
      }
      setReady(true);
    })();
  }, [refreshCart]);

  const signIn = (session) => { setToken(session.token); setUser(session.user); refreshCart(); };
  // Leaving a private page on sign-out: send visitors to the sign-in screen rather than leaving a dead page behind.
  const PRIVATE = /^\/(admin|account|orders|cart|custom-request)/;
  const signOut = () => { setToken(null); setUser(null); setCartCount(0); if (PRIVATE.test(path)) router.replace('/login'); };

  return <Ctx.Provider value={{ user, ready, signIn, signOut, cartCount, refreshCart }}>{children}</Ctx.Provider>;
}

/** Redirect-free guard: render children only when signed in. */
export function RequireAuth({ children, roles }) {
  const { user, ready } = useAuth();
  const Frame = ({ children: c }) => <div className="paper-page flex min-h-screen items-center justify-center px-6 py-16 text-center"><div className="max-w-md">{c}</div></div>;
  if (!ready) return <Frame><p className="mono text-[#3A0F1B]/60">Loading…</p></Frame>;
  if (!user) {
    return (
      <Frame>
        <p className="mono text-clay">Members only</p>
        <h1 className="mt-2 text-5xl text-[#3A0F1B]">Please sign in</h1>
        <p className="mt-3 text-[#3A0F1B]/65">to continue to this page.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a href={`/login?next=${encodeURIComponent(typeof window !== 'undefined' ? location.pathname : '/')}`} className="btn btn-navy">Sign in</a>
          <a href="/" className="btn btn-ghost text-[#3A0F1B]">Back to the site</a>
        </div>
      </Frame>
    );
  }
  if (roles && !roles.includes(user.role)) return <Frame><h1 className="text-4xl text-[#3A0F1B]">No access</h1><p className="mt-3 text-[#3A0F1B]/65">Your account can’t open this page.</p><a href="/" className="btn btn-navy mt-8">Back to the site</a></Frame>;
  return children;
}
