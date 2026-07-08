'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="card" style={{ marginTop: 48 }}>
      <h1>Mini App Kost Tiga Dara</h1>
      <p className="muted">Masuk dengan akun yang diberikan pengelola.</p>
      <form onSubmit={submit}>
        <label htmlFor="u">Username</label>
        <input id="u" value={username} onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none" autoComplete="username" required />
        <label htmlFor="p">Password</label>
        <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" required />
        {error && <p className="error">{error}</p>}
        <button disabled={loading}>{loading ? 'Memproses…' : 'Masuk'}</button>
      </form>
      <p className="muted" style={{ textAlign: 'center', margin: '16px 0 8px' }}>
        atau
      </p>
      <a href="/api/auth/google/login">
        <button type="button">Daftar / Masuk dengan Google</button>
      </a>
      <p className="muted" style={{ marginTop: 8 }}>
        Akun baru via Google perlu disetujui Owner dulu sebelum bisa dipakai.
      </p>
    </div>
  );
}
