'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Save, TriangleAlert } from 'lucide-react';

interface TipeRow {
  tipe: string;
  jumlahKamar: number;
  tidakSeragam: boolean;
  hargaBulan: number;
  harga2bulan: number;
  harga3bulan: number;
  harga6bulan: number;
  harga9bulan: number;
  hargaTahun: number;
  dp: number;
}

/** Kolom DB ← field form. Urutan = urutan tampil. */
const TIER: { key: keyof TipeRow; kolom: string; label: string; bulan: number }[] = [
  { key: 'hargaBulan', kolom: 'harga_bulan', label: '1 bulan', bulan: 1 },
  { key: 'harga2bulan', kolom: 'harga_2bulan', label: '2 bulan', bulan: 2 },
  { key: 'harga3bulan', kolom: 'harga_3bulan', label: '3 bulan', bulan: 3 },
  { key: 'harga6bulan', kolom: 'harga_6bulan', label: '6 bulan', bulan: 6 },
  { key: 'harga9bulan', kolom: 'harga_9bulan', label: '9 bulan', bulan: 9 },
  { key: 'hargaTahun', kolom: 'harga_tahun', label: '12 bulan', bulan: 12 }
];

const rp = (n: number) => 'Rp' + (Number.isFinite(n) ? n : 0).toLocaleString('id-ID');
const angka = (v: string) => Math.round(Number(String(v).replace(/[^0-9]/g, ''))) || 0;

export default function KamarHargaPanel() {
  const [rows, setRows] = useState<TipeRow[]>([]);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/admin/kamar');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat harga kamar.');
      setRows(json.data);
      const d: Record<string, Record<string, number>> = {};
      for (const r of json.data as TipeRow[]) {
        d[r.tipe] = Object.fromEntries(TIER.map((t) => [t.kolom, r[t.key] as number]));
      }
      setDraft(d);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat harga kamar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function ubah(tipe: string, kolom: string, nilai: string) {
    setDraft((d) => ({ ...d, [tipe]: { ...d[tipe], [kolom]: angka(nilai) } }));
    setOk('');
  }

  function berubah(r: TipeRow): boolean {
    const d = draft[r.tipe];
    if (!d) return false;
    return TIER.some((t) => d[t.kolom] !== (r[t.key] as number));
  }

  async function simpan(r: TipeRow) {
    setBusy(r.tipe);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/ops/admin/kamar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipe: r.tipe, ...draft[r.tipe] })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setOk(`Harga ${r.tipe} tersimpan — ${json.kamarTerdampak} kamar diperbarui. DP jadi ${rp(json.dp)}.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <p className="muted">
        <LoaderCircle size={16} className="spin" aria-hidden /> Memuat harga kamar…
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="error">
          <CircleAlert size={16} aria-hidden /> {error}
        </p>
      )}
      {ok && <p className="muted">{ok}</p>}

      <div className="card">
        <p className="muted" style={{ marginBottom: 4 }}>
          Harga berlaku <b>per tipe kamar</b> — menyimpan akan menimpa semua kamar bertipe sama.
          Angka yang dimasukkan adalah <b>total untuk seluruh durasi</b>, bukan per bulan.
        </p>
        <p className="muted">
          <b>DP otomatis 50%</b> dari tarif 1 bulan — tidak perlu (dan tidak bisa) diisi manual.
        </p>
      </div>

      {rows.map((r) => {
        const d = draft[r.tipe] ?? {};
        const dpBaru = Math.round((d.harga_bulan ?? 0) / 2);
        const dirty = berubah(r);
        return (
          <section className="card" key={r.tipe} style={{ marginTop: 14 }}>
            <div className="page-head" style={{ margin: 0, gap: 10 }}>
              <div>
                <h2 style={{ fontSize: '1.0625rem' }}>{r.tipe}</h2>
                <p className="page-head-sub">
                  {r.jumlahKamar} kamar · DP saat ini {rp(r.dp)}
                  {dpBaru !== r.dp && <> → <b>{rp(dpBaru)}</b></>}
                </p>
              </div>
            </div>

            {r.tidakSeragam && (
              <p className="error" style={{ marginTop: 8 }}>
                <TriangleAlert size={16} aria-hidden /> Harga antar-kamar tipe ini sekarang berbeda-beda.
                Menyimpan akan menyeragamkan semuanya.
              </p>
            )}

            <div className="module-grid" style={{ marginTop: 12 }}>
              {TIER.map((t) => {
                const total = d[t.kolom] ?? 0;
                return (
                  <label key={t.kolom} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="muted">{t.label}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={total ? total.toLocaleString('id-ID') : ''}
                      onChange={(e) => ubah(r.tipe, t.kolom, e.target.value)}
                      aria-label={`Harga ${t.label} tipe ${r.tipe}`}
                    />
                    <small className="muted">
                      {total > 0 ? `${rp(Math.round(total / t.bulan))}/bln` : '—'}
                    </small>
                  </label>
                );
              })}
            </div>

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={!dirty || busy === r.tipe} onClick={() => simpan(r)}>
                {busy === r.tipe ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Save size={16} aria-hidden />}
                {busy === r.tipe ? 'Menyimpan…' : dirty ? 'Simpan perubahan' : 'Belum ada perubahan'}
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}
