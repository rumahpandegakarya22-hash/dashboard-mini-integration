'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { CircleAlert, LoaderCircle, Trash2, Plus, Save, Pencil, X, Images } from 'lucide-react';
import LandingPhotoManager from '@/components/LandingPhotoManager';

/* ── Tipe Data ─────────────────────────────────────────────────────────── */

interface LandingData {
  properties: Record<string, any> | null;
  rooms: Record<string, any>[];
  facilities: Record<string, any>[];
  faqs: Record<string, any>[];
  gallery: Record<string, any>[];
  highlights: Record<string, any>[];
  testimonials: Record<string, any>[];
}

/* ── Helper ────────────────────────────────────────────────────────────── */

async function apiCall(method: string, body: object) {
  const res = await fetch('/api/ops/landing-page', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal melakukan operasi');
  return json;
}

/* ── Field ─────────────────────────────────────────────────────────────── */

interface FieldDef {
  key: string;
  label: string;
  type?: string;
  multiline?: boolean;
  hint?: string;      // keterangan lokasi/penggunaan di landing page
  preview?: boolean;  // tampilkan thumbnail dari nilai URL
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{f.label}</label>
      {f.multiline ? (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input type={f.type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} />
      )}
      {f.hint && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{f.hint}</p>
      )}
      {f.preview && value.trim() !== '' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          style={{ marginTop: 8, maxWidth: 200, maxHeight: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          onLoad={e => { (e.currentTarget as HTMLImageElement).style.display = 'block'; }}
        />
      )}
    </div>
  );
}

/* ── Komponen Tab ──────────────────────────────────────────────────────── */

const TABS = [
  { id: 'properties', label: 'Info Umum' },
  { id: 'rooms', label: 'Kamar' },
  { id: 'facilities', label: 'Fasilitas' },
  { id: 'faqs', label: 'FAQ' },
  { id: 'highlights', label: 'Highlight' },
  { id: 'gallery', label: 'Galeri' },
  { id: 'testimonials', label: 'Testimoni' }
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ── Form Info Umum (landing_properties) ──────────────────────────────── */

const PROP_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Nama Properti' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'city', label: 'Kota' },
  { key: 'address', label: 'Alamat', multiline: true },
  { key: 'address_detail', label: 'Detail Alamat' },
  { key: 'directions', label: 'Petunjuk Arah', multiline: true },
  { key: 'whatsapp_number', label: 'Nomor WhatsApp' },
  { key: 'phone_display', label: 'Nomor Tampil' },
  { key: 'maps_url', label: 'URL Google Maps' },
  { key: 'maps_embed_url', label: 'URL Embed Maps', multiline: true },
  { key: 'hero_photo_url', label: 'URL Foto Hero', hint: 'Dipakai: foto latar section paling atas (hero). Rasio 16:9 landscape. Kosongkan untuk pakai foto galeri pertama.', preview: true },
  { key: 'tour_video_url', label: 'URL Video Tour' },
  { key: 'tour_video_poster_url', label: 'URL Poster Video', hint: 'Dipakai: gambar poster sebelum video tour diputar (section Galeri). Rasio 16:9.', preview: true }
];

function PropertiesForm({ data, onSaved }: { data: Record<string, any>; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    const initial: Record<string, string> = {};
    PROP_FIELDS.forEach(f => { initial[f.key] = String(data[f.key] ?? ''); });
    setForm(initial);
  }, [data]);

  async function save() {
    setSaving(true); setErr(''); setOk('');
    try {
      await apiCall('PUT', { table: 'landing_properties', id: data.id, data: form });
      setOk('Tersimpan.');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-col" style={{ maxWidth: 640 }}>
      {err && <div className="banner error" style={{ marginBottom: 12 }}><CircleAlert size={16} /> {err}</div>}
      {ok && <div className="banner ok" style={{ marginBottom: 12 }}>{ok}</div>}
      {PROP_FIELDS.map(f => (
        <FieldInput
          key={f.key}
          f={f}
          value={form[f.key] ?? ''}
          onChange={v => setForm(p => ({ ...p, [f.key]: v }))}
        />
      ))}
      <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />}
        Simpan Info Umum
      </button>
    </div>
  );
}

/* ── Tabel Anak (add / delete) ─────────────────────────────────────────── */

interface ChildTableDef {
  table: string;
  label: string;
  addFields: FieldDef[];
  displayCols: { key: string; label: string }[];
}

const CHILD_DEFS: Record<string, ChildTableDef> = {
  rooms: {
    table: 'landing_rooms',
    label: 'Kamar',
    addFields: [
      { key: 'name', label: 'Nama Kamar' },
      { key: 'price', label: 'Harga (teks)' },
      { key: 'size', label: 'Ukuran' },
      { key: 'bed', label: 'Tempat Tidur' },
      { key: 'specs', label: 'Spesifikasi' },
      { key: 'note', label: 'Catatan' },
      { key: 'photo_url', label: 'URL Foto', hint: 'Dipakai: foto kartu kamar di section Pilihan Kamar. Rasio 4:3.', preview: true },
      { key: 'photo_alt', label: 'Alt Foto' },
      { key: 'order', label: 'Urutan', type: 'number' }
    ],
    displayCols: [{ key: 'name', label: 'Nama' }, { key: 'price', label: 'Harga' }, { key: 'size', label: 'Ukuran' }]
  },
  facilities: {
    table: 'landing_facilities',
    label: 'Fasilitas',
    addFields: [
      { key: 'name', label: 'Nama Fasilitas' },
      { key: 'description', label: 'Deskripsi', multiline: true },
      { key: 'icon', label: 'Ikon (nama lucide)' },
      { key: 'photo_url', label: 'URL Foto', hint: 'Dipakai: foto kartu fasilitas di section Fasilitas. Rasio 4:3.', preview: true },
      { key: 'photo_alt', label: 'Alt Foto' },
      { key: 'order', label: 'Urutan', type: 'number' }
    ],
    displayCols: [{ key: 'name', label: 'Nama' }, { key: 'description', label: 'Deskripsi' }]
  },
  faqs: {
    table: 'landing_faqs',
    label: 'FAQ',
    addFields: [
      { key: 'question', label: 'Pertanyaan' },
      { key: 'answer', label: 'Jawaban', multiline: true },
      { key: 'order', label: 'Urutan', type: 'number' }
    ],
    displayCols: [{ key: 'question', label: 'Pertanyaan' }, { key: 'answer', label: 'Jawaban' }]
  },
  highlights: {
    table: 'landing_highlights',
    label: 'Highlight',
    addFields: [
      { key: 'label', label: 'Label' },
      { key: 'icon', label: 'Ikon (nama lucide)' },
      { key: 'order', label: 'Urutan', type: 'number' }
    ],
    displayCols: [{ key: 'label', label: 'Label' }, { key: 'icon', label: 'Ikon' }]
  },
  gallery: {
    table: 'landing_gallery_photos',
    label: 'Galeri',
    addFields: [
      { key: 'url', label: 'URL Foto', hint: 'Dipakai: foto grid section Galeri. Foto galeri urutan pertama juga jadi fallback hero bila Foto Hero kosong.', preview: true },
      { key: 'alt', label: 'Alt Text' },
      { key: 'order', label: 'Urutan', type: 'number' }
    ],
    displayCols: [{ key: 'alt', label: 'Keterangan' }, { key: 'url', label: 'URL' }]
  },
  testimonials: {
    table: 'landing_testimonials',
    label: 'Testimoni',
    addFields: [
      { key: 'name', label: 'Nama' },
      { key: 'initials', label: 'Inisial' },
      { key: 'rating', label: 'Rating (1-5)', type: 'number' },
      { key: 'role', label: 'Role/Profesi' },
      { key: 'quote', label: 'Kutipan', multiline: true },
      { key: 'order', label: 'Urutan', type: 'number' }
    ],
    displayCols: [{ key: 'name', label: 'Nama' }, { key: 'quote', label: 'Kutipan' }]
  }
};

function ChildTable({
  tabId, rows, propertyId, onRefresh
}: { tabId: string; rows: Record<string, any>[]; propertyId: number; onRefresh: () => void }) {
  const def = CHILD_DEFS[tabId];
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [photoRoom, setPhotoRoom] = useState<number | null>(null); // baris kamar yg foto-nya sedang dikelola

  const isRooms = tabId === 'rooms';

  function openAdd() {
    setEditingId(null);
    setForm({});
    setShowForm(true);
    setErr('');
  }

  function openEdit(row: Record<string, any>) {
    const initial: Record<string, string> = {};
    def.addFields.forEach(f => { initial[f.key] = String(row[f.key] ?? ''); });
    setForm(initial);
    setEditingId(Number(row.id));
    setShowForm(true);
    setErr('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({});
  }

  async function saveRow() {
    setSaving(true); setErr('');
    try {
      if (editingId != null) {
        await apiCall('PUT', { table: def.table, id: editingId, data: form });
      } else {
        await apiCall('POST', { table: def.table, data: { ...form, property_id: propertyId } });
      }
      closeForm();
      onRefresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: number) {
    setBusy(id); setErr('');
    try {
      await apiCall('DELETE', { table: def.table, id });
      onRefresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {err && <div className="banner error" style={{ marginBottom: 12 }}><CircleAlert size={16} /> {err}</div>}

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {def.displayCols.map(c => (
                <th key={c.key} style={{ textAlign: 'left', padding: '6px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: 96 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={def.displayCols.length + 1} style={{ padding: '12px', color: 'var(--text-muted)' }}>Belum ada data</td></tr>
            ) : rows.map(row => (
              <Fragment key={row.id}>
              <tr style={{ borderBottom: photoRoom === row.id ? 'none' : '1px solid var(--border)' }}>
                {def.displayCols.map(c => (
                  <td key={c.key} style={{ padding: '8px 12px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(row[c.key] ?? '—')}
                  </td>
                ))}
                <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {isRooms && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 8px', color: photoRoom === row.id ? 'var(--brand)' : undefined }}
                      title="Kelola foto kamar"
                      onClick={() => setPhotoRoom(photoRoom === row.id ? null : Number(row.id))}
                    >
                      <Images size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '4px 8px' }}
                    title="Edit"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '4px 8px' }}
                    title="Hapus"
                    disabled={busy === row.id}
                    onClick={() => deleteRow(row.id)}
                  >
                    {busy === row.id ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}
                  </button>
                </td>
              </tr>
              {isRooms && photoRoom === row.id && (
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td colSpan={def.displayCols.length + 1} style={{ padding: '12px', background: 'var(--surface-2, rgba(0,0,0,0.02))' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Foto Kamar "{String(row.name ?? '')}" — cover & urutan slide</h4>
                    <LandingPhotoManager scope="room" roomId={Number(row.id)} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>
            {editingId != null ? `Edit ${def.label}` : `Tambah ${def.label}`}
          </h3>
          <div className="form-col" style={{ maxWidth: 560 }}>
            {def.addFields.map(f => (
              <FieldInput
                key={f.key}
                f={f}
                value={form[f.key] ?? ''}
                onChange={v => setForm(p => ({ ...p, [f.key]: v }))}
              />
            ))}
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={saveRow} disabled={saving}>
                {saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
                Simpan
              </button>
              <button className="btn btn-ghost" onClick={closeForm} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={16} /> Batal
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Tambah {def.label}
        </button>
      )}
    </div>
  );
}

/* ── Root Component ────────────────────────────────────────────────────── */

export default function LandingPageAdmin() {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('properties');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/landing-page');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="muted" style={{ padding: 24 }}><LoaderCircle size={20} className="spin" style={{ marginRight: 8 }} />Memuat data landing page…</div>;
  if (err) return <div className="banner error"><CircleAlert size={16} /> {err}</div>;
  if (!data) return null;

  const propertyId = data.properties?.id ?? 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? 'var(--brand)' : 'var(--text-muted)',
              borderBottom: activeTab === t.id ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom: -1,
              fontSize: 14
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'properties' && data.properties && (
        <PropertiesForm data={data.properties} onSaved={fetchData} />
      )}
      {activeTab === 'properties' && !data.properties && (
        <p className="muted">Data landing_properties belum ada. Hubungi developer untuk setup awal.</p>
      )}

      {activeTab === 'gallery' && (
        <>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Atur urutan foto galeri (naik/turun) dan pilih 1 foto <strong>cover</strong> (★). Foto cover dipakai sebagai latar hero bila Foto Hero di Info Umum kosong.
          </p>
          <LandingPhotoManager scope="gallery" />
        </>
      )}

      {activeTab !== 'properties' && activeTab !== 'gallery' && (
        <ChildTable
          tabId={activeTab}
          rows={data[activeTab] ?? []}
          propertyId={propertyId}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
