'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck, LoaderCircle, ShieldCheck, ShieldOff } from 'lucide-react';

interface SetupData {
  secret: string;
  qrDataUrl: string;
}

/**
 * Kelola 2FA TOTP kustom: setup (QR + kode manual) → enable (verifikasi kode),
 * atau disable (verifikasi kode). Secret hanya tampil sekali saat setup.
 */
export default function TotpSettings({ initialEnrolled }: { initialEnrolled: boolean }) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function call(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const res = await fetch(`/api/totp/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal.');
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function startSetup() {
    try {
      const json = await call('setup');
      setSetup({ secret: json.secret, qrDataUrl: json.qrDataUrl });
      setCode('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await call('enable', { code });
      setEnrolled(true);
      setSetup(null);
      setCode('');
      setDone('2FA aktif. Mulai sekarang, setiap login baru akan diminta kode Google Authenticator.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await call('disable', { code });
      setEnrolled(false);
      setCode('');
      setDone('2FA dimatikan.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const codeField = (
    <div className="field">
      <label htmlFor="totp-settings-code">Kode 6 digit</label>
      <input
        id="totp-settings-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
        required
      />
    </div>
  );

  return (
    <div className="card">
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12, marginTop: 0 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {done && (
        <div className="banner info" role="status" style={{ marginBottom: 12, marginTop: 0 }}>
          <CircleCheck size={16} />
          <span>{done}</span>
        </div>
      )}

      {enrolled ? (
        <>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} /> 2FA aktif
          </h2>
          <p className="muted" style={{ margin: '8px 0 16px' }}>
            Setiap login baru wajib memasukkan kode Google Authenticator. Untuk mematikan, masukkan kode yang
            sedang berlaku.
          </p>
          <form onSubmit={confirmDisable}>
            {codeField}
            <button type="submit" className="btn compact" disabled={busy || code.length !== 6}>
              {busy ? <LoaderCircle size={16} className="spin" /> : <ShieldOff size={16} />}
              Matikan 2FA
            </button>
          </form>
        </>
      ) : setup ? (
        <>
          <h2>Scan QR ini dengan Google Authenticator</h2>
          <p className="muted" style={{ margin: '8px 0 12px' }}>
            Buka Google Authenticator → tambah akun → scan QR. Tidak bisa scan? Masukkan kode manual di bawah.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrDataUrl}
            alt="QR code 2FA"
            width={220}
            height={220}
            style={{ display: 'block', margin: '0 auto 12px', borderRadius: 12, background: '#fff', padding: 8 }}
          />
          <p className="help" style={{ textAlign: 'center', marginBottom: 16, wordBreak: 'break-all' }}>
            Kode manual: <strong>{setup.secret}</strong>
          </p>
          <form onSubmit={confirmEnable}>
            {codeField}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn" disabled={busy || code.length !== 6}>
                {busy ? <LoaderCircle size={18} className="spin" /> : 'Aktifkan 2FA'}
              </button>
              <button type="button" className="btn secondary" onClick={() => setSetup(null)} disabled={busy}>
                Batal
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldOff size={18} /> 2FA belum aktif
          </h2>
          <p className="muted" style={{ margin: '8px 0 16px' }}>
            Lapisan keamanan tambahan: setelah login, kamu diminta kode 6 digit dari aplikasi Google
            Authenticator di HP kamu.
          </p>
          <button type="button" className="btn compact" onClick={startSetup} disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <ShieldCheck size={16} />}
            Aktifkan 2FA
          </button>
        </>
      )}
    </div>
  );
}
