'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, CircleAlert, LoaderCircle, User } from 'lucide-react';
import Modal from './Modal';

interface Penghuni {
  kamarId: string;
  idPenghuni: string;
  noKamar: string;
  namaLengkap: string;
  namaPanggilan: string;
  email: string;
  noHp: string;
  pekerjaan: string;
  instansi: string;
  tanggalLahir: string;
  asalDaerah: string;
  tanggalMasuk: string;
  nomorDarurat1: string;
  hubunganDarurat1: string;
  namaDarurat1: string;
  nomorDarurat2: string;
  hubunganDarurat2: string;
  namaDarurat2: string;
  linkIdentitas: string;
  tambahanListrik: number;
}

type Draft = Omit<Penghuni, 'kamarId' | 'idPenghuni' | 'noKamar'>;

const FIELDS: { key: keyof Draft; label: string; type?: string; required?: boolean }[] = [
  { key: 'namaLengkap', label: 'Nama Lengkap', required: true },
  { key: 'namaPanggilan', label: 'Nama Panggilan' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'noHp', label: 'No. HP / WhatsApp' },
  { key: 'pekerjaan', label: 'Pekerjaan' },
  { key: 'instansi', label: 'Instansi / Kampus' },
  { key: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'asalDaerah', label: 'Asal Daerah' },
  { key: 'tanggalMasuk', label: 'Tanggal Masuk', type: 'date' },
  { key: 'nomorDarurat1', label: 'No. Darurat 1' },
  { key: 'hubunganDarurat1', label: 'Hubungan Kontak Darurat 1' },
  { key: 'namaDarurat1', label: 'Nama Kontak Darurat 1' },
  { key: 'nomorDarurat2', label: 'No. Darurat 2' },
  { key: 'hubunganDarurat2', label: 'Hubungan Kontak Darurat 2' },
  { key: 'namaDarurat2', label: 'Nama Kontak Darurat 2' },
  { key: 'linkIdentitas', label: 'Link Identitas (Drive)' },
  { key: 'tambahanListrik', label: 'Tambahan Listrik (Rp/bln)', type: 'number' }
];

function toDraft(p: Penghuni): Draft {
  return {
    namaLengkap: p.namaLengkap,
    namaPanggilan: p.namaPanggilan,
    email: p.email,
    noHp: p.noHp,
    pekerjaan: p.pekerjaan,
    instansi: p.instansi,
    tanggalLahir: p.tanggalLahir,
    asalDaerah: p.asalDaerah,
    tanggalMasuk: p.tanggalMasuk,
    nomorDarurat1: p.nomorDarurat1,
    hubunganDarurat1: p.hubunganDarurat1,
    namaDarurat1: p.namaDarurat1,
    nomorDarurat2: p.nomorDarurat2,
    hubunganDarurat2: p.hubunganDarurat2,
    namaDarurat2: p.namaDarurat2,
    linkIdentitas: p.linkIdentitas,
    tambahanListrik: p.tambahanListrik
  };
}

function isDirty(p: Penghuni, d: Draft): boolean {
  return FIELDS.some((f) => String(d[f.key] ?? '') !== String((p as any)[f.key] ?? ''));
}

export default function PenghuniPanel() {
  const [data, setData] = useState<Penghuni[] | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [cari, setCari] = useState('');

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/ops/admin/penghuni');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setData(json.data);
      setDraft(Object.fromEntries((json.data as Penghuni[]).map((p) => [p.kamarId, toDraft(p)])));
    } catch (e: any) {
      setError(e.message || 'Gagal memuat.');
    }
  }

  useEffect(() => { load(); }, []);

  const ubah = (id: string, patch: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function simpan(p: Penghuni) {
    const d = draft[p.kamarId];
    if (!d) return;
    setBusy(p.kamarId);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/penghuni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kamarId: p.kamarId, ...d })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setInfo(`Data penghuni kamar ${p.noKamar} tersimpan.`);
      setTerbuka(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(null);
    }
  }

  const tampil = data?.filter((p) => {
    if (!cari) return true;
    const q = cari.toLowerCase();
    return (
      p.namaLengkap.toLowerCase().includes(q) ||
      p.noKamar.includes(q) ||
      p.idPenghuni.toLowerCase().includes(q)
    );
  });

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

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Cari nama, kamar, atau ID penghuni…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          style={{ flex: 1, maxWidth: 360 }}
        />
      </div>

      {data === null && (
        <div className="card" aria-busy="true">
          <div className="skeleton" style={{ height: 20, width: '40%' }} />
          <div className="skeleton" style={{ height: 56, marginTop: 14 }} />
        </div>
      )}

      {tampil?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {cari ? 'Tidak ada penghuni yang cocok.' : 'Belum ada data penghuni aktif.'}
          </p>
        </div>
      )}

      <div className="bento-grid">
        {tampil?.map((p) => {
          const d = draft[p.kamarId] ?? toDraft(p);
          const dirty = isDirty(p, d);
          const open = terbuka === p.kamarId;
          return (
            <div key={p.kamarId} className="bento-card border-beam">
              <button
                type="button"
                className="bento-head"
                aria-haspopup="dialog"
                onClick={() => setTerbuka(p.kamarId)}
              >
                <span className="icon-tile" aria-hidden>
                  <User size={18} />
                </span>
                <span className="bento-meta">
                  <span className="bento-title">{p.namaLengkap}</span>
                  <span className="bento-sub">
                    Kamar {p.noKamar}
                    {p.idPenghuni ? ` · ${p.idPenghuni}` : ''}
                  </span>
                </span>
                <ChevronRight size={20} className="accordion-chevron" aria-hidden />
              </button>

              <Modal open={open} title={`Kamar ${p.noKamar} — ${p.namaLengkap}`} onClose={() => setTerbuka(null)}>
                <div className="form-col">
                  {FIELDS.map((f) => (
                    <div className="field" key={f.key}>
                      <label htmlFor={`${p.kamarId}-${f.key}`}>
                        {f.label}
                        {f.required && <span className="req"> *</span>}
                      </label>
                      <input
                        id={`${p.kamarId}-${f.key}`}
                        type={f.type ?? 'text'}
                        value={String(d[f.key] ?? '')}
                        onChange={(e) =>
                          ubah(p.kamarId, { [f.key]: f.type === 'number' ? Number(e.target.value) || 0 : e.target.value } as Partial<Draft>)
                        }
                      />
                    </div>
                  ))}

                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy === p.kamarId || !dirty || !d.namaLengkap.trim()}
                      onClick={() => simpan(p)}
                    >
                      {busy === p.kamarId && <LoaderCircle size={18} className="spin" />}
                      {dirty ? 'Simpan Perubahan' : 'Belum Ada Perubahan'}
                    </button>
                  </div>
                </div>
              </Modal>
            </div>
          );
        })}
      </div>
    </div>
  );
}
