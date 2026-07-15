'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import { CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react';

/** Form step-up: kode 6 digit Google Authenticator → cookie step-up → beranda. */
export default function TotpVerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Verifikasi gagal.');
      router.replace('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Verifikasi gagal.');
      setBusy(false);
    }
  }

  return (
    <div className="center-card card">
      <div className="page-head" style={{ margin: '0 0 14px' }}>
        <span className="icon-tile lg" aria-hidden>
          <ShieldCheck size={24} />
        </span>
        <div>
          <h2>Verifikasi 2FA</h2>
          <p className="page-head-sub">Masukkan kode dari aplikasi Google Authenticator.</p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="totp-code">Kode 6 digit</label>
          <input
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            autoFocus
            required
          />
        </div>

        {error && (
          <div className="banner error" role="alert">
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy || code.length !== 6}>
            {busy ? <LoaderCircle size={18} className="spin" /> : 'Verifikasi'}
          </button>
        </div>
      </form>

      <div className="divider">atau</div>
      <SignOutButton redirectUrl="/login">
        <button type="button" className="btn-plain" style={{ width: '100%', justifyContent: 'center' }}>
          Keluar &amp; login dengan akun lain
        </button>
      </SignOutButton>
    </div>
  );
}
