'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, MessageSquareWarning, Paperclip } from 'lucide-react';
import { STATUS_PENGADUAN, type StatusPengaduan } from '@/lib/core/complain';
import OriginSelect from '@/components/ui/OriginSelect';

interface Aduan {
  id: string;
  penghuni: string;
  kategori: string;
  judul: string;
  isi: string;
  status: StatusPengaduan;
  dilaporkan: string;
  selesai: string | null;
  tanggapan: string;
  ditanggapiOleh: string | null;
  ditanggapiPada: string | null;
  foto: string[];
}

/**
 * Hanya dua varian badge yang ada di theme-ops.css (`prio-badge` dan
 * `.hot`), jadi yang ditonjolkan cuma "belum disentuh sama sekali". Teks
 * statusnya selalu ikut tampil, jadi warna tidak pernah jadi satu-satunya
 * pembeda.
 */
const KELAS_STATUS: Record<StatusPengaduan, string> = {
  Menunggu: 'prio-badge hot',
  Diproses: 'prio-badge',
  Selesai: 'prio-badge',
  Dibatalkan: 'prio-badge'
};

/**
 * Panel "Pengaduan Penghuni" di bawah form modul Feedback: daftar pengaduan yang
 * masuk dari aplikasi Teman Rara, lengkap dengan foto bukti, plus aksi ubah
 * status & tulis tanggapan.
 *
 * Form input Feedback di atasnya TIDAK digantikan — itu jalur untuk feedback
 * yang dilaporkan lisan ke staf, yang tidak punya asal-usul di aplikasi penghuni.
 */
export default function PengaduanPanel() {
  const [data, setData] = useState<Aduan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sukses, setSukses] = useState('');
  const [semua, setSemua] = useState(false);
  const [draft, setDraft] = useState<Record<string, { status: StatusPengaduan; tanggapan: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load(filterSemua = semua) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/pengaduan${filterSemua ? '?filter=semua' : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat pengaduan.');
      setData(json.data);
      setDraft(
        Object.fromEntries(
          (json.data as Aduan[]).map((a) => [a.id, { status: a.status, tanggapan: a.tanggapan }])
        )
      );
    } catch (e: any) {
      setError(e.message || 'Gagal memuat pengaduan.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    // Sekali saat panel dipasang; perubahan filter memuat ulang lewat handler-nya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simpan(a: Aduan) {
    const d = draft[a.id];
    if (!d) return;
    setBusy(a.id);
    setError('');
    setSukses('');
    try {
      const res = await fetch('/api/ops/pengaduan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, status: d.status, tanggapan: d.tanggapan })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setSukses(`Pengaduan "${a.judul}" diperbarui jadi ${d.status}. Penghuni dapat notifikasi di sinkronisasi harian berikutnya.`);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(null);
    }
  }

  const ubah = (id: string, patch: Partial<{ status: StatusPengaduan; tanggapan: string }>) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return (
    <section aria-label="Pengaduan Penghuni" style={{ marginTop: 28 }}>
      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquareWarning size={16} /> Pengaduan Penghuni
        {data && <span className="count-badge">{data.length}</span>}
      </h2>

      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {sukses && (
        <div className="banner info" role="status" style={{ marginBottom: 12 }}>
          <span>{sukses}</span>
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={semua ? 'btn secondary' : 'btn'}
          onClick={() => {
            setSemua(false);
            load(false);
          }}
        >
          Perlu Ditindak
        </button>
        <button
          type="button"
          className={semua ? 'btn' : 'btn secondary'}
          onClick={() => {
            setSemua(true);
            load(true);
          }}
        >
          Semua
        </button>
      </div>

      {loading && (
        <div className="card" aria-busy="true" aria-label="Memuat pengaduan">
          <div className="skeleton" style={{ height: 20, width: '45%' }} />
          <div className="skeleton" style={{ height: 72, marginTop: 14 }} />
          <div className="skeleton" style={{ height: 72, marginTop: 10 }} />
        </div>
      )}

      {!loading && data?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {semua ? 'Belum ada pengaduan sama sekali.' : 'Tidak ada pengaduan yang perlu ditindak. Rapi.'}
          </p>
        </div>
      )}

      <div className="panel-grid">
        {!loading &&
          data?.map((a) => {
            const d = draft[a.id] ?? { status: a.status, tanggapan: a.tanggapan };
            const menutup = d.status === 'Selesai' || d.status === 'Dibatalkan';
            const berubah = d.status !== a.status || d.tanggapan !== a.tanggapan;
            return (
            <div key={a.id} className="card border-beam">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <span className={KELAS_STATUS[a.status]}>{a.status}</span>
                <span className="muted" style={{ fontSize: '0.8125rem' }}>
                  {a.kategori} · {a.dilaporkan}
                </span>
              </div>

              <h3 style={{ fontSize: '1rem', margin: '8px 0 2px' }}>{a.judul}</h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
                {a.penghuni}
              </p>
              {a.isi && (
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-line', marginTop: 10 }}>{a.isi}</p>
              )}

              {a.foto.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {a.foto.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="btn-plain">
                      <Paperclip size={16} />
                      Lihat foto
                    </a>
                  ))}
                </div>
              )}

              {a.ditanggapiOleh && (
                <p className="muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>
                  Tanggapan terakhir oleh {a.ditanggapiOleh} · {a.ditanggapiPada}
                </p>
              )}

              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor={`status-${a.id}`}>Status</label>
                <OriginSelect
                  id={`status-${a.id}`}
                  ariaLabel="Status"
                  value={d.status}
                  onChange={(v) => ubah(a.id, { status: v as StatusPengaduan })}
                  options={STATUS_PENGADUAN.map((s) => ({ value: s, label: s }))}
                />
              </div>

              <div className="field">
                <label htmlFor={`tanggapan-${a.id}`}>
                  Tanggapan {menutup && <span className="req">*</span>}
                </label>
                <textarea
                  id={`tanggapan-${a.id}`}
                  rows={3}
                  maxLength={2000}
                  value={d.tanggapan}
                  placeholder="Ditulis untuk penghuni — jelaskan tindakan atau alasannya."
                  onChange={(e) => ubah(a.id, { tanggapan: e.target.value })}
                />
                <p className="help">Tampil di aplikasi Teman Rara milik pelapor.</p>
              </div>

              <button
                type="button"
                className="btn"
                disabled={busy === a.id || !berubah || (menutup && !d.tanggapan.trim())}
                onClick={() => simpan(a)}
              >
                {busy === a.id && <LoaderCircle size={18} className="spin" />}
                {busy === a.id ? 'Menyimpan...' : 'Simpan Tanggapan'}
              </button>
            </div>
            );
          })}
      </div>
    </section>
  );
}
