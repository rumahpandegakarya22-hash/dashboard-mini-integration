'use client';

import { useEffect, useState } from 'react';

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export default function EmailTujuanLaporanPanel() {
  const [daftar, setDaftar] = useState<string[]>([]);
  const [asli, setAsli] = useState<string[]>([]);
  const [maks, setMaks] = useState(10);
  const [input, setInput] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: 'error' | 'info'; teks: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ops/admin/laporan-email');
        const data = (await res.json()) as { penerima?: string[]; maks?: number; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Gagal memuat email tujuan.');
        setDaftar(data.penerima ?? []);
        setAsli(data.penerima ?? []);
        if (data.maks) setMaks(data.maks);
      } catch (e: unknown) {
        setPesan({ jenis: 'error', teks: e instanceof Error ? e.message : 'Gagal memuat email tujuan.' });
      } finally {
        setMemuat(false);
      }
    })();
  }, []);

  // Boleh tempel beberapa alamat sekaligus (pisah koma, spasi, atau baris baru).
  function tambah() {
    const kandidat = [...new Set(input.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (kandidat.length === 0) return;
    const salah = kandidat.find((e) => !EMAIL_RE.test(e));
    if (salah) return setPesan({ jenis: 'error', teks: `Email tidak valid: "${salah}".` });
    const baru = [...new Set([...daftar, ...kandidat])];
    if (baru.length > maks) return setPesan({ jenis: 'error', teks: `Maksimal ${maks} email.` });
    setDaftar(baru);
    setInput('');
    setPesan(null);
  }

  async function simpan() {
    setMenyimpan(true);
    setPesan(null);
    try {
      const res = await fetch('/api/ops/admin/laporan-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ penerima: daftar }),
      });
      const data = (await res.json()) as { penerima?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan.');
      setDaftar(data.penerima ?? daftar);
      setAsli(data.penerima ?? daftar);
      setPesan({ jenis: 'info', teks: 'Email tujuan disimpan.' });
    } catch (e: unknown) {
      setPesan({ jenis: 'error', teks: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally {
      setMenyimpan(false);
    }
  }

  const berubah = daftar.join(',') !== asli.join(',');

  return (
    <div className="card">
      <h2 style={{ fontWeight: 600, fontSize: '1em', marginBottom: 4 }}>Email Tujuan Laporan Bulanan</h2>
      <p className="muted" style={{ marginBottom: 12, fontSize: '0.85em' }}>
        Tiap tanggal 1–3, semua PDF laporan bulan lalu (termasuk Owner Review) dikirim ke semua alamat di bawah dalam satu email. Hanya owner yang bisa mengubah daftar ini.
      </p>

      {pesan && (
        <div className={`banner ${pesan.jenis}`} role={pesan.jenis === 'error' ? 'alert' : 'status'} style={{ marginBottom: 12 }}>
          {pesan.teks}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="text"
          className="input"
          placeholder="nama@email.com (boleh tempel beberapa sekaligus)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } }}
          style={{ flex: 1, minWidth: 220 }}
          aria-label="Tambah email tujuan"
        />
        <button className="btn secondary compact" onClick={tambah} disabled={!input.trim()}>Tambah</button>
      </div>

      {memuat ? (
        <p className="muted">Memuat…</p>
      ) : daftar.length === 0 ? (
        <p className="muted">Belum ada email tujuan. Email bulanan tidak akan dikirim.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {daftar.map((e) => (
            <li key={e} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ overflowWrap: 'anywhere' }}>{e}</span>
              <button className="btn secondary compact" onClick={() => setDaftar(daftar.filter((x) => x !== e))} aria-label={`Hapus ${e}`}>Hapus</button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn compact" onClick={() => void simpan()} disabled={menyimpan || !berubah}>
        {menyimpan ? 'Menyimpan…' : 'Simpan'}
      </button>
      <span className="muted" style={{ marginLeft: 10, fontSize: '0.85em' }}>{daftar.length}/{maks} email</span>
    </div>
  );
}
