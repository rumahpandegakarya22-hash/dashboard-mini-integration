'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, ClipboardCheck, LoaderCircle } from 'lucide-react';
import Modal from './Modal';
import FileUploadCard from './ui/FileUploadCard';
import { KONDISI_ITEMS, KONDISI_OPTIONS } from '@/lib/kondisi-items';
import type { KondisiValue } from '@/lib/kondisi-items';

interface Props {
  fase: 'awal' | 'akhir';
}

type KondisiStatus = 'Draft' | 'Menunggu' | 'Disetujui' | 'Ditolak';

type KamarRow = {
  id_penghuni: string;
  kk_id: number | null;
  nama: string;
  no_kamar: string | number;
  status: KondisiStatus | null;
  existingItems: Partial<Record<string, string>>;
  existingCatatan: string;
  existingTanggal: string;
  existingPic: string;
  // check-in only
  no_booking?: string;
  tgl_masuk?: string;
};

// ---- Raw API row shapes ----
type ItemColAwal = `item${string}_awal`;
type ItemColAkhir = `item${string}_akhir`;

type CheckInApiRow = {
  no_booking: string;
  id_penghuni: string;
  nama_penyewa: string;
  kamar_no: number | string;
  tgl_masuk: string;
  no_hp: string;
  kk_id: number | null;
  status_checkin: string | null;
  catatan_awal: string | null;
  tanggal_cek_awal: string | null;
  pic: string | null;
} & Record<ItemColAwal, string | null>;

type CheckOutApiRow = {
  kamar_id: string;
  no_kamar: number | string;
  nama_lengkap: string;
  no_hp: string;
  id_penghuni: string;
  kk_id: number | null;
  status_checkout: string | null;
  catatan_akhir: string | null;
  tanggal_cek_akhir: string | null;
} & Record<ItemColAkhir, string | null>;

function isValidStatus(s: string | null | undefined): KondisiStatus | null {
  if (s === 'Draft' || s === 'Menunggu' || s === 'Disetujui' || s === 'Ditolak') return s;
  return null;
}

function extractItems(row: Record<string, unknown>, suffix: '_awal' | '_akhir'): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  for (const { key } of KONDISI_ITEMS) {
    const col = `${key}${suffix}`;
    const val = row[col];
    if (typeof val === 'string' && val) result[key] = val;
  }
  return result;
}

function normalizeCheckIn(row: CheckInApiRow): KamarRow {
  return {
    id_penghuni: row.id_penghuni,
    kk_id: row.kk_id,
    nama: row.nama_penyewa,
    no_kamar: row.kamar_no,
    status: isValidStatus(row.status_checkin),
    existingItems: extractItems(row as unknown as Record<string, unknown>, '_awal'),
    existingCatatan: row.catatan_awal ?? '',
    existingTanggal: row.tanggal_cek_awal ?? '',
    existingPic: row.pic ?? '',
    no_booking: row.no_booking,
    tgl_masuk: row.tgl_masuk,
  };
}

function normalizeCheckOut(row: CheckOutApiRow): KamarRow {
  return {
    id_penghuni: row.id_penghuni,
    kk_id: row.kk_id,
    nama: row.nama_lengkap,
    no_kamar: row.no_kamar,
    status: isValidStatus(row.status_checkout),
    existingItems: extractItems(row as unknown as Record<string, unknown>, '_akhir'),
    existingCatatan: row.catatan_akhir ?? '',
    existingTanggal: row.tanggal_cek_akhir ?? '',
    existingPic: '',
  };
}

function initFormItems(existingItems: Partial<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key } of KONDISI_ITEMS) {
    result[key] = existingItems[key] ?? 'Baik';
  }
  return result;
}

const STATUS_BADGE: Record<KondisiStatus, { label: string; color: string }> = {
  Draft: { label: 'Draft', color: '#6b7280' },
  Menunggu: { label: 'Menunggu', color: '#d97706' },
  Disetujui: { label: 'Disetujui', color: '#16a34a' },
  Ditolak: { label: 'Ditolak', color: '#dc2626' },
};

export default function KondisiKamarPanel({ fase }: Props) {
  const [rows, setRows] = useState<KamarRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KamarRow | null>(null);
  const [formItems, setFormItems] = useState<Record<string, string>>({});
  const [catatan, setCatatan] = useState('');
  const [tanggal, setTanggal] = useState('');
  const [pic, setPic] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // foto state — hanya relevan untuk fase awal
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const apiPath = fase === 'awal' ? '/api/ops/admin/pre-checkin' : '/api/ops/admin/pre-checkout';

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(apiPath);
      const json = await res.json() as { data: unknown[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat data.');

      if (fase === 'awal') {
        setRows((json.data as CheckInApiRow[]).map(normalizeCheckIn));
      } else {
        setRows((json.data as CheckOutApiRow[]).map(normalizeCheckOut));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat data.');
    }
  }, [apiPath, fase]);

  useEffect(() => {
    load();
  }, [load]);

  function openModal(row: KamarRow) {
    setSelected(row);
    setFormItems(initFormItems(row.existingItems));
    setCatatan(row.existingCatatan);
    setTanggal(row.existingTanggal);
    setPic(row.existingPic);
    setFotoFile(null);
    setFotoUrl(null);
    setFotoUploading(false);
    setSubmitError(null);
  }

  function closeModal() {
    setSelected(null);
    setSubmitError(null);
  }

  async function handleFotoPick(file: File) {
    setFotoFile(file);
    setFotoUploading(true);
    setFotoUrl(null);
    try {
      if (file.size > 2 * 1024 * 1024) {
        setSubmitError('Ukuran foto melebihi 2 MB.');
        setFotoUploading(false);
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'kondisi-kamar');
      const res = await fetch('/api/ops/upload', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengunggah foto.');
      setFotoUrl(data.url ?? null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setFotoUploading(false);
    }
  }

  function removeFoto() {
    setFotoFile(null);
    setFotoUrl(null);
  }

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    setSubmitError(null);
    try {
      let body: Record<string, unknown>;
      if (fase === 'awal') {
        body = {
          kk_id: selected.kk_id ?? undefined,
          id_penghuni: selected.id_penghuni,
          no_kamar: selected.no_kamar,
          nama_penghuni: selected.nama,
          items: formItems,
          catatan_awal: catatan,
          tanggal_cek_awal: tanggal,
          pic,
          ...(fotoUrl ? { fotos: [fotoUrl] } : {}),
        };
      } else {
        body = {
          kk_id: selected.kk_id ?? undefined,
          id_penghuni: selected.id_penghuni,
          no_kamar: selected.no_kamar,
          nama_penghuni: selected.nama,
          items: formItems,
          catatan_akhir: catatan,
          tanggal_cek_akhir: tanggal,
          pic,
        };
      }

      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan.');

      // Update state in-place: ubah status menjadi 'Menunggu'
      setRows((prev) =>
        prev?.map((r) =>
          r.id_penghuni === selected.id_penghuni
            ? { ...r, status: 'Menunggu' as KondisiStatus }
            : r
        ) ?? prev
      );
      closeModal();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  const isReadonly =
    selected?.status === 'Menunggu' || selected?.status === 'Disetujui';

  const modalTitle =
    selected
      ? fase === 'awal'
        ? `Pre-Check In: Kamar ${selected.no_kamar}`
        : `Pre-Check Out: Kamar ${selected.no_kamar}`
      : '';

  return (
    <div>
      {loadError && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{loadError}</span>
        </div>
      )}

      {rows === null && !loadError && (
        <div className="bento-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bento-card">
              <div className="skeleton" style={{ height: 18, width: '60%' }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {rows?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Tidak ada data yang perlu diisi saat ini.
          </p>
        </div>
      )}

      <div className="bento-grid">
        {rows?.map((row) => {
          const badge = row.status ? STATUS_BADGE[row.status] : STATUS_BADGE.Draft;
          const disabled = row.status === 'Menunggu' || row.status === 'Disetujui';
          return (
            <div key={`${row.id_penghuni}-${row.no_kamar}`} className="bento-card border-beam">
              <div className="bento-head" style={{ pointerEvents: 'none' }}>
                <span className="icon-tile" aria-hidden>
                  <ClipboardCheck size={18} />
                </span>
                <span className="bento-meta">
                  <span className="bento-title">{row.nama}</span>
                  <span className="bento-sub">Kamar {row.no_kamar}</span>
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: badge.color,
                    border: `1px solid ${badge.color}`,
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  {badge.label}
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%' }}
                  disabled={disabled}
                  onClick={() => openModal(row)}
                >
                  Isi Form
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={selected !== null} title={modalTitle} onClose={closeModal}>
        {selected && (
          <div className="form-col">
            {isReadonly && (
              <div className="banner warn" role="status" style={{ marginBottom: 8 }}>
                <span>Form sudah diajukan dan tidak dapat diubah.</span>
              </div>
            )}

            {submitError && (
              <div className="banner error" role="alert" style={{ marginBottom: 8 }}>
                <CircleAlert size={16} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Tabel 26 item — dirender dari KONDISI_ITEMS */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                      No
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                      Item
                    </th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                      Kondisi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {KONDISI_ITEMS.map(({ no, key, label }) => (
                    <tr key={key}>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', color: 'var(--text-muted)' }}>
                        {no}
                      </td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                        {label}
                      </td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                        <select
                          value={formItems[key] ?? 'Baik'}
                          disabled={isReadonly}
                          onChange={(e) =>
                            setFormItems((prev) => ({ ...prev, [key]: e.target.value as KondisiValue }))
                          }
                          style={{ width: '100%', minWidth: 160 }}
                        >
                          {KONDISI_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="kk-tanggal">Tanggal Cek</label>
              <input
                id="kk-tanggal"
                type="date"
                value={tanggal}
                disabled={isReadonly}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="kk-pic">PIC (Nama Petugas)</label>
              <input
                id="kk-pic"
                type="text"
                value={pic}
                disabled={isReadonly}
                onChange={(e) => setPic(e.target.value)}
                placeholder="Nama petugas yang mengecek"
              />
            </div>

            <div className="field">
              <label htmlFor="kk-catatan">Catatan</label>
              <textarea
                id="kk-catatan"
                value={catatan}
                disabled={isReadonly}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan kondisi umum kamar..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {fase === 'awal' && !isReadonly && (
              <div className="field">
                <label>Foto Kamar (opsional)</label>
                <FileUploadCard
                  judul="Foto Kondisi Kamar"
                  deskripsi="Unggah foto kondisi kamar saat check-in"
                  petunjuk="Format: JPG atau PNG. Maks 2 MB."
                  accept="image/jpeg,image/png"
                  berkas={fotoFile ? { nama: fotoFile.name, ukuran: fotoFile.size } : null}
                  uploading={fotoUploading}
                  done={fotoUrl !== null}
                  onPick={handleFotoPick}
                  onRemove={removeFoto}
                  disabled={saving}
                />
              </div>
            )}

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                disabled={saving || isReadonly || fotoUploading}
                onClick={handleSubmit}
              >
                {saving && <LoaderCircle size={16} className="spin" />}
                {fase === 'awal' ? 'Ajukan Pre-Check In' : 'Ajukan Pre-Check Out'}
              </button>
              <button type="button" className="btn secondary" onClick={closeModal}>
                Batal
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
