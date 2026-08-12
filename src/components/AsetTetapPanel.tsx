'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Plus, Trash2, Save } from 'lucide-react';

type Kategori = 'Bangunan' | 'Elektronik' | 'Furniture' | 'Peralatan Operasional';

interface AsetRow {
  id: number;
  nama: string;
  kategori: Kategori;
  harga_perolehan: number;
  nilai_residu: number;
  tanggal_perolehan: string;
  umur_bulan: number;
  per_bulan: number;
  akumulasi: number;
  nilai_buku: number;
  lunas: boolean;
}

const KAT_UMUR: Record<Kategori, number> = {
  'Bangunan': 240, 'Elektronik': 48, 'Furniture': 96, 'Peralatan Operasional': 48,
};
const KATEGORI_LIST = Object.keys(KAT_UMUR) as Kategori[];

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AsetTetapPanel() {
  const [rows, setRows] = useState<AsetRow[] | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [periode, setPeriode] = useState(bulanIni());

  const [form, setForm] = useState({
    nama: '', kategori: 'Elektronik' as Kategori, harga_perolehan: '',
    tanggal_perolehan: '', umur_bulan: String(KAT_UMUR['Elektronik']), nilai_residu: '0', catatan: '',
  });

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/ops/admin/aset-tetap');
      const json = await res.json() as { aset: AsetRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat data.');
      setRows(json.aset);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function setKategori(k: Kategori) {
    setForm((f) => ({ ...f, kategori: k, umur_bulan: String(KAT_UMUR[k]) }));
  }

  async function tambah() {
    setSaving(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/ops/admin/aset-tetap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          nama: form.nama,
          kategori: form.kategori,
          harga_perolehan: Number(form.harga_perolehan),
          nilai_residu: Number(form.nilai_residu || 0),
          tanggal_perolehan: form.tanggal_perolehan,
          umur_bulan: Number(form.umur_bulan),
          catatan: form.catatan,
        }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan.');
      setInfo(`Aset "${form.nama}" ditambahkan.`);
      setForm((f) => ({ ...f, nama: '', harga_perolehan: '', tanggal_perolehan: '', nilai_residu: '0', catatan: '' }));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function hapus(id: number, nama: string) {
    if (!confirm(`Hapus aset "${nama}"? Jurnal penyusutan yang sudah tercatat tetap tersimpan.`)) return;
    setBusy(id); setError(''); setInfo('');
    try {
      const res = await fetch('/api/ops/admin/aset-tetap', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal menghapus.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
    } finally {
      setBusy(null);
    }
  }

  async function postingPenyusutan() {
    setPosting(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/ops/admin/aset-tetap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'posting', sampaiPeriode: periode }),
      });
      const json = await res.json() as { ok?: boolean; posted?: number; total?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal posting.');
      setInfo(`Posting selesai: ${json.posted ?? 0} entri penyusutan, total ${rp(json.total ?? 0)}.`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal posting.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <div className="banner error" role="alert"><CircleAlert size={16} /> <span>{error}</span></div>}
      {info && <div className="banner info" role="status"><span>{info}</span></div>}

      {/* Tambah aset */}
      <div className="card form-col">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Tambah Aset Tetap</h2>
        <div className="field">
          <label>Nama Aset</label>
          <input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Mis. AC Kamar 12" />
        </div>
        <div className="field">
          <label>Kategori</label>
          <select value={form.kategori} onChange={(e) => setKategori(e.target.value as Kategori)}>
            {KATEGORI_LIST.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Harga Perolehan (Rp)</label>
          <input type="number" min={0} value={form.harga_perolehan} onChange={(e) => setForm((f) => ({ ...f, harga_perolehan: e.target.value }))} />
        </div>
        <div className="field">
          <label>Tanggal Perolehan</label>
          <input type="date" value={form.tanggal_perolehan} onChange={(e) => setForm((f) => ({ ...f, tanggal_perolehan: e.target.value }))} />
        </div>
        <div className="field">
          <label>Umur Manfaat (bulan)</label>
          <input type="number" min={1} value={form.umur_bulan} onChange={(e) => setForm((f) => ({ ...f, umur_bulan: e.target.value }))} />
          <span className="muted" style={{ fontSize: '0.8rem' }}>Default {form.kategori}: {KAT_UMUR[form.kategori]} bulan ({Math.round(KAT_UMUR[form.kategori] / 12)} th). Garis lurus.</span>
        </div>
        <div className="field">
          <label>Nilai Residu (Rp)</label>
          <input type="number" min={0} value={form.nilai_residu} onChange={(e) => setForm((f) => ({ ...f, nilai_residu: e.target.value }))} />
        </div>
        <button className="btn" onClick={() => void tambah()} disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} Tambah Aset
        </button>
      </div>

      {/* Posting penyusutan */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Posting Penyusutan Bulanan</h2>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
          Membuat jurnal penyusutan (garis lurus) untuk semua aset aktif, dari bulan perolehan s/d periode terpilih. Aman diulang — bulan yang sudah diposting dilewati.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn" onClick={() => void postingPenyusutan()} disabled={posting || !periode}>
            {posting ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} Posting s/d bulan ini
          </button>
        </div>
      </div>

      {/* Daftar aset */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Daftar Aset Tetap</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama</th><th>Kategori</th><th>Tgl Perolehan</th><th>Harga</th>
                <th>Penyusutan/bln</th><th>Akumulasi</th><th>Nilai Buku</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={8} className="muted">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="muted">Belum ada aset. Tambahkan di atas.</td></tr>
              ) : rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.nama}{a.lunas && <span className="muted" style={{ fontSize: '0.72rem' }}> · lunas</span>}</td>
                  <td>{a.kategori}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{a.tanggal_perolehan}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{rp(a.harga_perolehan)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{rp(a.per_bulan)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{rp(a.akumulasi)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{rp(a.nilai_buku)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px' }} disabled={busy === a.id} onClick={() => void hapus(a.id, a.nama)} title="Hapus">
                      {busy === a.id ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
