'use client';

import { useMemo, useState } from 'react';
import { Copy, RotateCcw, Send } from 'lucide-react';
import type { TemplateInfo } from '@/lib/draft-info/parse-html';
import { HARI, daftarIsian, formatRupiah, namaHari, segmenPesan, susunPesan, tautanWhatsApp, type Isian } from '@/lib/draft-info/render';

const SEMUA = 'semua';

/** "BAB I — PENGUMUMAN OPERASIONAL & FASILITAS" → "Pengumuman Operasional & Fasilitas" */
const namaBab = (bab: string) =>
  bab
    .replace(/^BAB\s+[IVXLC]+\s*[—-]\s*/i, '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export default function DraftInfoPanel({ templates }: { templates: TemplateInfo[] }) {
  const [bab, setBab] = useState(SEMUA);
  const [cari, setCari] = useState('');
  const [no, setNo] = useState<string | null>(null);
  const [semuaNilai, setSemuaNilai] = useState<Record<string, Record<string, string>>>({});
  const [info, setInfo] = useState('');

  const daftarBab = useMemo(() => [...new Set(templates.map((t) => t.bab))], [templates]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return templates.filter((t) => (bab === SEMUA || t.bab === bab) && (!q || `${t.no} ${t.judul}`.toLowerCase().includes(q)));
  }, [templates, bab, cari]);

  const terpilih = templates.find((t) => t.no === no) ?? null;
  const nilai = (no && semuaNilai[no]) || {};
  const isian = useMemo(() => (terpilih ? daftarIsian(terpilih.isi) : []), [terpilih]);
  const pesan = useMemo(() => (terpilih ? susunPesan(terpilih.isi, nilai) : null), [terpilih, nilai]);
  const segmen = useMemo(() => (terpilih ? segmenPesan(terpilih.isi, nilai) : []), [terpilih, nilai]);

  const ubah = (kunci: string, v: string) => {
    setInfo('');
    if (no) setSemuaNilai((s) => ({ ...s, [no]: { ...s[no], [kunci]: v } }));
  };

  function kirim() {
    if (!pesan || pesan.kosong.length) return;
    const url = tautanWhatsApp(pesan.teks);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.assign(url);
  }

  async function salin() {
    if (!pesan) return;
    try {
      await navigator.clipboard.writeText(pesan.teks);
      setInfo('Teks disalin. Tempel di WhatsApp.');
    } catch {
      setInfo('Gagal menyalin otomatis. Blok teks pratinjau lalu salin manual.');
    }
  }

  const tanggalTerisi = isian.find((i) => i.jenis === 'tanggal' && nilai[i.kunci]);

  function kolom(i: Isian) {
    const v = nilai[i.kunci] ?? '';
    const id = `isi-${no}-${i.kunci}`;
    switch (i.jenis) {
      case 'hari':
        return (
          <select id={id} value={v} onChange={(e) => ubah(i.kunci, e.target.value)}>
            <option value="">{tanggalTerisi ? `Otomatis: ${namaHari(nilai[tanggalTerisi.kunci])}` : 'Pilih hari'}</option>
            {HARI.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        );
      case 'tanggal':
        return <input id={id} type="date" value={v} onChange={(e) => ubah(i.kunci, e.target.value)} />;
      case 'bulan':
        return <input id={id} type="month" value={v} onChange={(e) => ubah(i.kunci, e.target.value)} />;
      case 'jam':
        return <input id={id} type="time" value={v} onChange={(e) => ubah(i.kunci, e.target.value)} />;
      case 'rupiah':
        return <input id={id} type="text" inputMode="numeric" value={v} placeholder="Contoh: 1.200.000" onChange={(e) => ubah(i.kunci, formatRupiah(e.target.value))} />;
      case 'teksPanjang':
        return <textarea id={id} rows={3} value={v} placeholder={i.petunjuk} onChange={(e) => ubah(i.kunci, e.target.value)} />;
      default:
        return <input id={id} type="text" value={v} placeholder={i.petunjuk} onChange={(e) => ubah(i.kunci, e.target.value)} />;
    }
  }

  return (
    <>
      <div className="card">
        <p className="muted" style={{ marginBottom: 4 }}>
          Pilih template, isi detailnya (tanggal, jam, area, dan lainnya), lalu klik <b>Kirim ke WhatsApp</b>. Pesan sudah terformat dan
          terbuka sebagai draf di WhatsApp. <b>Pilih grup tujuan</b>, periksa sekali lagi, lalu tekan kirim.
        </p>
        <p className="muted">Isian yang berdiri sendiri di satu baris (mis. nama penghuni kedua) boleh dikosongkan; barisnya otomatis dibuang.</p>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="module-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="di-bab">Kategori</label>
            <select id="di-bab" value={bab} onChange={(e) => setBab(e.target.value)}>
              <option value={SEMUA}>Semua kategori</option>
              {daftarBab.map((b) => (
                <option key={b} value={b}>{namaBab(b)}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="di-cari">Cari template</label>
            <input id="di-cari" type="text" value={cari} placeholder="Contoh: paket, AC, promo" onChange={(e) => setCari(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tampil.length === 0 && <p className="muted">Tidak ada template yang cocok.</p>}
          {tampil.map((t) => (
            <button
              key={t.no}
              type="button"
              className={t.no === no ? 'btn' : 'btn-plain'}
              onClick={() => { setNo(t.no); setInfo(''); }}
              aria-pressed={t.no === no}
            >
              {t.no}. {t.judul}
            </button>
          ))}
        </div>
      </div>

      {terpilih && pesan && (
        <section className="card" style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: '1.0625rem' }}>{terpilih.no}. {terpilih.judul}</h2>
          <p className="page-head-sub">{namaBab(terpilih.bab)}</p>
          {terpilih.catatan && <div className="banner info" style={{ marginTop: 10 }}>{terpilih.catatan}</div>}

          {isian.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {isian.map((i) => (
                <div className="field" key={i.kunci}>
                  <label htmlFor={`isi-${no}-${i.kunci}`}>
                    {i.label}
                    {i.opsional && <span className="muted" style={{ fontWeight: 400 }}> (opsional)</span>}
                  </label>
                  {kolom(i)}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: '0.9375rem', margin: '4px 0 8px' }}>Pratinjau pesan</h3>
          <div
            role="region"
            aria-label="Pratinjau pesan"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '14px 16px', lineHeight: 1.55 }}
          >
            {segmen.map((s, k) =>
              s.kosong ? (
                <span key={k} style={{ fontWeight: 700, color: '#1f4e79', background: 'rgba(31,78,121,.16)', borderRadius: 4, padding: '0 3px' }}>{s.teks}</span>
              ) : s.isian ? (
                <span key={k} style={{ background: 'rgba(214,168,58,.25)', borderRadius: 4 }}>{s.teks}</span>
              ) : (
                <span key={k}>{s.teks}</span>
              )
            )}
          </div>
          <p className="help">Tanda *teks* di WhatsApp tampil sebagai huruf tebal. Bagian bergaris biru adalah isian yang belum diisi.</p>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={kirim} disabled={pesan.kosong.length > 0}>
              <Send size={16} aria-hidden /> Kirim ke WhatsApp
            </button>
            <button type="button" className="btn-plain" onClick={salin}>
              <Copy size={16} aria-hidden /> Salin teks
            </button>
            <button type="button" className="btn-plain" onClick={() => no && setSemuaNilai((s) => ({ ...s, [no]: {} }))}>
              <RotateCcw size={16} aria-hidden /> Kosongkan isian
            </button>
          </div>
          {pesan.kosong.length > 0 && <p className="help">Lengkapi dulu: {pesan.kosong.join(', ')}.</p>}
          {info && <p className="muted" role="status">{info}</p>}
        </section>
      )}
    </>
  );
}
