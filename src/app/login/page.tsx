'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CircleAlert, Eye, EyeOff, House, KeyRound, LoaderCircle, UserRound } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal.');
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <motion.div
        className="center-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span className="icon-tile lg" aria-hidden>
            <House size={26} />
          </span>
          <h1 style={{ fontSize: '1.375rem', textAlign: 'center' }}>Mini App Kost Tiga Dara</h1>
          <p className="muted" style={{ textAlign: 'center' }}>
            Masuk dengan akun yang diberikan pengelola.
          </p>
        </div>

        <div className="card">
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="u">Username</label>
              <div className="input-icon">
                <UserRound size={18} />
                <input
                  id="u"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="p">Password</label>
              <div className="input-icon">
                <KeyRound size={18} />
                <input
                  id="p"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="banner error" role="alert">
                <CircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <button className="btn" disabled={loading} style={{ marginTop: 18 }}>
              {loading && <LoaderCircle size={18} className="spin" />}
              {loading ? 'Memproses…' : 'Masuk'}
            </button>
          </form>

          <div className="divider" aria-hidden>
            atau
          </div>

          <a href="/api/auth/google/login" style={{ textDecoration: 'none' }}>
            <span className="btn secondary" role="button">
              <GoogleG />
              Daftar / Masuk dengan Google
            </span>
          </a>
          <p className="help" style={{ marginTop: 12, textAlign: 'center' }}>
            Akun baru via Google perlu disetujui Owner dulu sebelum bisa dipakai.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/** Logo resmi Google "G" (multiwarna) untuk tombol OAuth. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
