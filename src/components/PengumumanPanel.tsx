'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Megaphone, Plus, Trash2 } from 'lucide-react';
import OriginSelect from '@/components/ui/OriginSelect';

type Tipe = 'announcement' | 'rule';

interface Entri {
  id: string;
  tipe: Tipe;
  judul: string;
  isi: string;
  urutan: number;
  terbit: string;
  diubah: string;
  diubahOleh: string | null;
}

const LABEL_TIPE: Record<Tipe, string> = { announcement: 'Pengumuman', rule: 'Peraturan' };

const KOSONG = { tipe: 'announcement' as Tipe, judul: '', isi: '', urutan: 0 };

export default function PengumumanPanel() {
  const [data, setData] = useState<Entri[] | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<typeof KOSONG>(KOSONG);
  const [editId, setEditId] = useState<string | null>(null);
  const [kirimNotif, setKirimNotif] = useState(false);

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/ops/admin/pengumuman');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setData(json.data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function reset() {
    setForm(KOSONG);
    setEditId(null);
    setKirimNotif(false);
  }

  async function simpan() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/pengumuman', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { ...form, id: editId, kirimNotifikasi: kirimNotif } : form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setInfo(json.peringatan || (editId ? 'Perubahan tersimpan.' : 'Pengumuman terbit dan push notifikasi dikirim.'));
      reset();
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function hapus(e: Entri) {
    if (!confirm(`Hapus "${e.judul}" dari papan informasi penghuni?`)) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/ops/admin/pengumuman?id=${encodeURIComponent(e.id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus.');
      setInfo(`"${e.judul}" dihapus dari papan informasi.`);
      if (editId === e.id) reset();
      await load();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus.');
    } finally {
      setBusy(false);
    }
  }

  const valid = form.judul.trim().length >= 3 && form.isi.trim().length >= 3;

  return (
    <div>
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="banner info" role="status" style={{ marginBottom: 12 }}>
          <span>{info}</span>
        </div>
      )}

      <div className="card form-col" style={{ marginBottom: 16 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editId ? <Megaphone size={18} /> : <Plus size={18} />}
          {editId ? 'Ubah Entri' : 'Buat Baru'}
        </h2>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="tipe">Tipe</label>
          <OriginSelect
            id="tipe"
            ariaLabel="Tipe"
            value={form.tipe}
            onChange={(v) => setForm({ ...form, tipe: v as Tipe })}
            options={[
              { value: 'announcement', label: 'Pengumuman tampil di daftar pengumuman' },
              { value: 'rule', label: 'Peraturan  tampil di beranda penghuni' }
            ]}
          />
        </div>

        <div className="field">
          <label htmlFor="judul">
            Judul <span className="req">*</span>
          </label>
          <input
            id="judul"
            value={form.judul}
            maxLength={200}
            placeholder="Contoh: Pemadaman air Sabtu 09.00–12.00"
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="isi">
            Isi <span className="req">*</span>
          </label>
          <textarea
            id="isi"
            rows={5}
            maxLength={10000}
            value={form.isi}
            placeholder="Tulis lengkap — ini yang dibaca penghuni."
            onChange={(e) => setForm({ ...form, isi: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="urutan">Urutan Tampil</label>
          <input
            id="urutan"
            type="number"
            min={0}
            value={form.urutan}
            onChange={(e) => setForm({ ...form, urutan: Number(e.target.value) })}
          />
          <p className="help">Angka kecil urutan teratas pada Peraturan. Pengumuman selalu urut terbaru.</p>
        </div>

        {editId && (
          <div className="field">
            <label htmlFor="notif" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                id="notif"
                type="checkbox"
                checked={kirimNotif}
                style={{ width: 'auto', minHeight: 0 }}
                onChange={(e) => setKirimNotif(e.target.checked)}
              />
              Kirim ulang notifikasi 
            </label>
            <p className="help">Hanya terkirim kalau judul atau isinya benar-benar berubah.</p>
          </div>
        )}

        <div className="btn-row">
          <button type="button" className="btn" disabled={busy || !valid} onClick={simpan}>
            {busy && <LoaderCircle size={18} className="spin" />}
            {busy ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Terbitkan'}
          </button>
          {editId && (
            <button type="button" className="btn secondary" disabled={busy} onClick={reset}>
              Batal
            </button>
          )}
        </div>
      </div>

      <h2 className="section-title">Papan Informasi Saat Ini</h2>

      {data === null && (
        <div className="card" aria-busy="true" aria-label="Memuat papan informasi">
          <div className="skeleton" style={{ height: 20, width: '40%' }} />
          <div className="skeleton" style={{ height: 56, marginTop: 14 }} />
        </div>
      )}

      {data?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Papan informasi masih kosong.
          </p>
        </div>
      )}

      <div className="panel-grid">
        {data?.map((e) => (
        <div key={e.id} className="card border-beam">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span className="prio-badge">{LABEL_TIPE[e.tipe]}</span>
            <span className="muted" style={{ fontSize: '0.8125rem' }}>
              Terbit {e.terbit}
              {e.diubahOleh && ` · diubah ${e.diubah} oleh ${e.diubahOleh}`}
            </span>
          </div>
          <h3 style={{ fontSize: '1rem', margin: '8px 0 4px' }}>{e.judul}</h3>
          <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>
            {e.isi.length > 240 ? `${e.isi.slice(0, 240)}…` : e.isi}
          </p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                setForm({ tipe: e.tipe, judul: e.judul, isi: e.isi, urutan: e.urutan });
                setEditId(e.id);
                setKirimNotif(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Ubah
            </button>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => hapus(e)}>
              <Trash2 size={16} />
              Hapus
            </button>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
