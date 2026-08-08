'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, LoaderCircle, ArrowRightLeft, LogOut } from 'lucide-react';

/* Panel pengelola untuk pengajuan Pindah Kamar / Checkout dari Teman Rara.
   Satu komponen, dua jenis — bedanya cuma teks & aksi 'Selesai':
     - pindah  : Selesai dieksekusi di sini (perpindahan langsung jalan)
     - checkout: Selesai lewat modul Checkout (tombol mengarahkan ke sana) */

interface Pengajuan {
  id: string;
  penghuni: string;
  idPenghuni: string;
  kamarLama: string;
  kamarBaru: string | null;
  tanggal: string;
  alasan: string;
  catatan: string;
  status: string;
  penghuniLabel: string;
  responseNote: string | null;
}

const TEKS = {
  pindah: { judul: 'Pengajuan Pindah Kamar', Ikon: ArrowRightLeft },
  checkout: { judul: 'Pengajuan Checkout', Ikon: LogOut }
} as const;

export default function PengajuanPanel({ jenis }: { jenis: 'pindah' | 'checkout' }) {
  const { judul, Ikon } = TEKS[jenis];
  const [list, setList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [alasan, setAlasan] = useState<Record<string, string>>({});
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/pengajuan?jenis=${jenis}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat pengajuan.');
      setList(json.data ?? []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenis]);

  async function proses(p: Pengajuan, aksi: 'setuju' | 'tolak' | 'selesai') {
    setBusy(p.id);
    setInfo('');
    setErr('');
    try {
      const res = await fetch('/api/ops/pengajuan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jenis, id: p.id, aksi, alasan: alasan[p.id] ?? '' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses.');
      setInfo(
        aksi === 'setuju'
          ? `Pengajuan ${p.penghuni} disetujui — sekarang On Process.`
          : aksi === 'tolak'
            ? `Pengajuan ${p.penghuni} ditolak.`
            : json.peringatan
              ? `Pindah kamar ${p.penghuni} selesai. ${json.peringatan}`
              : `Pindah kamar ${p.penghuni} selesai — data sudah diperbarui.`
      );
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ikon size={20} /> {judul}
      </h2>

      {info && (
        <div className="banner ok" role="status" style={{ marginBottom: 12 }}>
          {info}
        </div>
      )}
      {err && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} /> {err}
        </div>
      )}

      {loading ? (
        <p className="muted">Memuat…</p>
      ) : list.length === 0 ? (
        <p className="muted">Tidak ada pengajuan yang perlu ditindak.</p>
      ) : (
        list.map((p) => {
          const onProcess = p.status === 'Disetujui';
          return (
            <div key={p.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{p.penghuni}</strong>
                <span className={`badge ${onProcess ? 'badge-proc' : ''}`}>{onProcess ? 'On Process' : p.status}</span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {jenis === 'pindah' ? `Kamar ${p.kamarLama} → ${p.kamarBaru}` : `Kamar ${p.kamarLama}`} · {p.tanggal}
              </div>
              {p.alasan && <div style={{ fontSize: 13, marginTop: 6 }}>Alasan: {p.alasan}</div>}
              {p.catatan && <div className="muted" style={{ fontSize: 13 }}>Catatan: {p.catatan}</div>}

              {p.status === 'Menunggu' && (
                <>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor={`tolak-${p.id}`}>Alasan penolakan</label>
                    <input
                      id={`tolak-${p.id}`}
                      maxLength={500}
                      value={alasan[p.id] ?? ''}
                      placeholder="Wajib diisi kalau pengajuan ditolak"
                      onChange={(e) => setAlasan((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                  </div>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn" disabled={busy === p.id} onClick={() => proses(p, 'setuju')}>
                      {busy === p.id && <LoaderCircle size={18} className="spin" />} Setujui
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy === p.id || (alasan[p.id] ?? '').trim().length < 5}
                      onClick={() => proses(p, 'tolak')}
                    >
                      Tolak
                    </button>
                  </div>
                </>
              )}

              {onProcess &&
                (jenis === 'pindah' ? (
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button type="button" className="btn" disabled={busy === p.id} onClick={() => proses(p, 'selesai')}>
                      {busy === p.id && <LoaderCircle size={18} className="spin" />} Tandai Selesai (pindahkan sekarang)
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <Link className="btn" href={`/ops/m/checkout?penghuni=${encodeURIComponent(p.penghuniLabel || p.idPenghuni)}`}>
                      Lanjut ke Checkout →
                    </Link>
                    <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Deposit, kondisi kamar, dan tunggakan diisi di modul Checkout. Pengajuan otomatis Selesai begitu checkout dicatat.
                    </p>
                  </div>
                ))}
            </div>
          );
        })
      )}
    </section>
  );
}
