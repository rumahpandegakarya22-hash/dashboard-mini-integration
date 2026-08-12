'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Save } from 'lucide-react';

/* Daftar key MENGIKUTI DEFAULT_COPY di repo landing (lib/copy.ts). Placeholder =
   teks bawaan; kosongkan field untuk memakai bawaan itu. */
interface CopyField { key: string; label: string; def: string; area?: boolean; }
const GROUPS: { title: string; fields: CopyField[] }[] = [
  { title: 'Hero (paling atas)', fields: [
    { key: 'hero_cta_primary', label: 'Tombol utama', def: 'Lihat Kamar & Harga' },
    { key: 'hero_cta_secondary', label: 'Tombol kedua', def: 'Hubungi Kami' },
  ]},
  { title: 'Galeri', fields: [
    { key: 'gallery_eyebrow', label: 'Label kecil (eyebrow)', def: 'Galeri' },
    { key: 'gallery_title', label: 'Judul', def: 'Foto & Video Suasana Kost' },
    { key: 'gallery_desc', label: 'Deskripsi', def: 'Lihat langsung kondisi setiap sudut properti — dari kamar, dapur, hingga ruang bersama.', area: true },
    { key: 'gallery_video_title', label: 'Judul video tur', def: 'Video Tur Singkat' },
  ]},
  { title: 'Foto Setiap Nomor Kamar', fields: [
    { key: 'kamar_photos_eyebrow', label: 'Label kecil', def: 'Foto Kamar' },
    { key: 'kamar_photos_title', label: 'Judul', def: 'Foto Setiap Nomor Kamar' },
    { key: 'kamar_photos_desc', label: 'Deskripsi', def: 'Lihat kondisi tiap kamar secara langsung sebelum memilih.', area: true },
  ]},
  { title: 'Kamar & Harga', fields: [
    { key: 'rooms_eyebrow', label: 'Label kecil', def: 'Kamar & Harga' },
    { key: 'rooms_title', label: 'Judul', def: 'Pilih Tipe Kamar Sesuai Kebutuhan' },
    { key: 'rooms_desc', label: 'Deskripsi', def: 'Semua harga transparan, sudah termasuk kebersihan area umum. Bandingkan spesifikasi tiap tipe sebelum menghubungi kami.', area: true },
    { key: 'rooms_card_cta', label: 'Tombol di kartu kamar', def: 'Tanya Kamar Ini' },
  ]},
  { title: 'Cek Ketersediaan', fields: [
    { key: 'availability_eyebrow', label: 'Label kecil', def: 'Cek Ketersediaan' },
    { key: 'availability_title', label: 'Judul', def: 'Kamar Masih Tersedia?' },
    { key: 'availability_desc', label: 'Deskripsi', def: 'Masukkan rencana tanggal masuk dan tipe kamar untuk cek ketersediaan secara langsung dari data terkini.', area: true },
    { key: 'availability_submit', label: 'Tombol cek', def: 'Cek Ketersediaan' },
  ]},
  { title: 'Fasilitas Umum', fields: [
    { key: 'facilities_eyebrow', label: 'Label kecil', def: 'Fasilitas Umum' },
    { key: 'facilities_title', label: 'Judul', def: 'Fasilitas Bersama untuk Semua Penghuni' },
    { key: 'facilities_desc', label: 'Deskripsi', def: 'Area umum yang lengkap dan terawat, bisa digunakan bebas oleh seluruh penghuni kost.', area: true },
  ]},
  { title: 'Lokasi', fields: [
    { key: 'location_eyebrow', label: 'Label kecil', def: 'Lokasi' },
    { key: 'location_title', label: 'Judul', def: 'Mudah Dijangkau, Strategis untuk Aktivitas Harian' },
    { key: 'location_desc', label: 'Deskripsi', def: 'Cek jarak dan rute menuju kost sebelum berkunjung langsung.', area: true },
    { key: 'location_address_label', label: 'Label "Alamat Lengkap"', def: 'Alamat Lengkap' },
    { key: 'location_directions_label', label: 'Label "Petunjuk Arah"', def: 'Petunjuk Arah' },
  ]},
  { title: 'Testimoni', fields: [
    { key: 'testimonials_eyebrow', label: 'Label kecil', def: 'Testimoni' },
    { key: 'testimonials_title', label: 'Judul', def: 'Apa Kata Penghuni' },
    { key: 'testimonials_desc', label: 'Deskripsi', def: 'Pengalaman nyata dari mereka yang sudah tinggal di sini.', area: true },
  ]},
  { title: 'FAQ', fields: [
    { key: 'faq_eyebrow', label: 'Label kecil', def: 'FAQ' },
    { key: 'faq_title', label: 'Judul', def: 'Pertanyaan yang Sering Diajukan' },
    { key: 'faq_desc', label: 'Deskripsi', def: 'Masih ragu? Cek dulu jawaban dari pertanyaan yang paling sering ditanyakan.', area: true },
  ]},
  { title: 'Hubungi Kami (CTA bawah)', fields: [
    { key: 'cta_eyebrow', label: 'Label kecil', def: 'Hubungi Kami' },
    { key: 'cta_title', label: 'Judul', def: 'Siap Menempati Kamar Impian Anda?' },
    { key: 'cta_desc', label: 'Deskripsi', def: 'Chat langsung via WhatsApp, atau tinggalkan nomor Anda agar kami yang menghubungi balik.', area: true },
    { key: 'cta_whatsapp_title', label: 'Judul kartu WhatsApp', def: 'Chat via WhatsApp' },
    { key: 'cta_form_title', label: 'Judul kartu formulir', def: 'Minta Dihubungi Balik' },
  ]},
];

export default function LandingCopyEditor() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ops/landing-page/copy');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat teks.');
        setForm(json.copy ?? {});
      } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true); setErr(''); setOk('');
    try {
      const res = await fetch('/api/ops/landing-page/copy', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setOk('Teks halaman tersimpan. Perubahan tampil di landing dalam beberapa menit.');
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  if (loading) return <p className="muted"><LoaderCircle size={16} className="spin" style={{ marginRight: 6 }} />Memuat teks…</p>;

  return (
    <div>
      {err && <div className="banner error" style={{ marginBottom: 12 }}><CircleAlert size={16} /> {err}</div>}
      {ok && <div className="banner info" style={{ marginBottom: 12 }}>{ok}</div>}
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Kosongkan field untuk memakai teks bawaan (ditampilkan sebagai placeholder abu-abu).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
        {GROUPS.map(g => (
          <div key={g.title} className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--brand)' }}>{g.title}</h3>
            <div className="form-col">
              {g.fields.map(f => (
                <div key={f.key} className="field">
                  <label>{f.label}</label>
                  {f.area ? (
                    <textarea rows={2} value={form[f.key] ?? ''} placeholder={f.def}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  ) : (
                    <input value={form[f.key] ?? ''} placeholder={f.def}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 16 }}>
        {saving ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} Simpan Semua Teks
      </button>
    </div>
  );
}
