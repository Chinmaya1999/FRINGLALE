'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const GOOGLE_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function LoginClient() {
  const { signIn } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [mode, setMode] = useState('otp');
  const [f, setF] = useState({ name: '', email: '', password: '', mobile: '', code: '' });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const gbtn = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Only same-site relative paths are honoured, to avoid open redirects.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  // Staff land in the admin workspace; customers in their account. An explicit ?next= wins.
  const destFor = (user) => safeNext || (user?.role === 'admin' || user?.role === 'designer' ? '/admin' : '/account');

  useEffect(() => {
    if (!GOOGLE_ID) return;
    const s = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true });
    s.onload = () => {
      window.google?.accounts.id.initialize({ client_id: GOOGLE_ID, callback: async ({ credential }) => {
        try { const s = await api('/auth/google', { method: 'POST', body: { idToken: credential } }); signIn(s); router.push(destFor(s.user)); } catch (e) { setErr(e.message); }
      } });
      window.google?.accounts.id.renderButton(gbtn.current, { theme: 'outline', size: 'large', width: 300 });
    };
    document.body.appendChild(s);
    return () => s.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn) {
    setErr(null); setBusy(true);
    try { await fn(); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  const done = (session) => { signIn(session); router.push(destFor(session.user)); };

  return (
    <div className="paper-page grid min-h-[86vh] lg:grid-cols-2">
      <div className="relative hidden items-center justify-center overflow-hidden bg-[#3A0F1B] lg:flex">
        <div className="text-center"><img src="/brand/logo-full.png" alt="Fringlale — Jewellery Beyond Imagination" className="blend-screen w-[34rem] max-w-full" /><p className="serif -mt-4 text-xl italic text-[#3A0F1B]">Make My Jewel — My Choice, My Jewel</p></div>
      </div>
      <div className="flex items-center justify-center px-4 py-16"><div className="w-full max-w-md">
      <h1 className="text-3xl text-[#3A0F1B]">Welcome to Fringlale</h1>
      <div className="mt-6 flex gap-2" role="tablist">
        {[['otp', 'Mobile OTP'], ['login', 'Email'], ['register', 'Create account']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setErr(null); }} className={`btn !px-4 !py-1.5 text-xs ${mode === k ? 'btn-navy' : 'btn-ghost text-[#3A0F1B]'}`}>{l}</button>))}
      </div>
      <form className="card mt-4 space-y-3 p-5" onSubmit={(e) => e.preventDefault()}>
        {mode === 'otp' && <>
          <label className="block"><span className="label">Mobile number</span><input className="input mt-1" inputMode="numeric" autoComplete="tel" placeholder="98XXXXXXXX" value={f.mobile} onChange={set('mobile')} disabled={sent} /></label>
          {sent && <label className="block"><span className="label">6-digit code</span><input className="input mt-1" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.code} onChange={set('code')} /></label>}
          {info && <p className="rounded bg-amber-100 p-2 text-xs text-amber-900">{info}</p>}
          {!sent ? <button className="btn btn-navy w-full" disabled={busy} onClick={() => run(async () => { const r = await api('/auth/otp/request', { method: 'POST', body: { mobile: f.mobile } }); setSent(true); if (r.devOtp) setInfo(`Development mode — your code is ${r.devOtp}`); })}>Send code</button>
            : <button className="btn btn-navy w-full" disabled={busy} onClick={() => run(async () => done(await api('/auth/otp/verify', { method: 'POST', body: { mobile: f.mobile, code: f.code } })))}>Verify &amp; sign in</button>}
        </>}
        {mode === 'login' && <>
          <label className="block"><span className="label">Email</span><input type="email" autoComplete="email" className="input mt-1" value={f.email} onChange={set('email')} /></label>
          <label className="block"><span className="label">Password</span><input type="password" autoComplete="current-password" className="input mt-1" value={f.password} onChange={set('password')} /></label>
          <button className="btn btn-navy w-full" disabled={busy} onClick={() => run(async () => done(await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password } })))}>Sign in</button>
        </>}
        {mode === 'register' && <>
          <label className="block"><span className="label">Full name</span><input autoComplete="name" className="input mt-1" value={f.name} onChange={set('name')} /></label>
          <label className="block"><span className="label">Email</span><input type="email" autoComplete="email" className="input mt-1" value={f.email} onChange={set('email')} /></label>
          <label className="block"><span className="label">Password (min 8 characters)</span><input type="password" autoComplete="new-password" className="input mt-1" value={f.password} onChange={set('password')} /></label>
          <button className="btn btn-navy w-full" disabled={busy} onClick={() => run(async () => done(await api('/auth/register', { method: 'POST', body: { name: f.name, email: f.email, password: f.password } })))}>Create account</button>
        </>}
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        {GOOGLE_ID && <div className="pt-2"><div className="gold-rule mb-3" /><div ref={gbtn} /></div>}
      </form>
      </div></div>
    </div>
  );
}
