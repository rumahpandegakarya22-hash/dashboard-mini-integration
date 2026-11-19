'use client';

import { useMemo, useState } from 'react';
import { Copy, RotateCcw, Send } from 'lucide-react';
import type { TemplateInfo } from '@/lib/draft-info/parse-html';
import {
  HARI, daftarIsian, formatRupiah, gabungTanggalJam, namaHari, perangkatSeluler, pisahTanggalJam, segmenPesan, susunPesan, tautanWhatsApp,
  type Isian
} from '@/lib/draft-info/render';

/** "BAB I — PENGUMUMAN OPERASIONAL & FASILITAS" → "Pengumuman Operasional & Fasilitas" */
const namaBab = (bab: string) =>
  bab
    .replace(/^BAB\s+[IVXLC]+\s*[—-]\s*/i, '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export default function DraftInfoPanel({ templates }: { templates: TemplateInfo[] }) {
  const [no, setNo] = useState<string | null>(null);
  const [semuaNilai, setSemuaNilai] = useState<Record<string, Record<string, string>>>({});
  const [info, setInfo] = useState('');

  const perBab = useMemo(
    () => [...new Set(templates.map((t) => t.bab))].map((b) => ({ bab: b, daftar: templates.filter((t) => t.bab === b) })),
    [templates]
  );

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
    const url = tautanWhatsApp(pesan.teks, perangkatSeluler(navigator.userAgent, navigator.maxTouchPoints));
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
      case 'tanggalJam': {
        const { tanggal, jam } = pisahTanggalJam(v);
        return (
          <div className="module-grid">
            <input id={id} type="date" aria-label={`${i.label}: tanggal`} value={tanggal} onChange={(e) => ubah(i.kunci, gabungTanggalJam(e.target.value, jam))} />
            <input type="time" aria-label={`${i.label}: jam`} value={jam} onChange={(e) => ubah(i.kunci, gabungTanggalJam(tanggal, e.target.value))} />
          </div>
        );
      }
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
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="di-template">Template pesan</label>
          <select id="di-template" value={no ?? ''} onChange={(e) => { setNo(e.target.value || null); setInfo(''); }}>
            <option value="">Pilih template…</option>
            {perBab.map((g) => (
              <optgroup key={g.bab} label={namaBab(g.bab)}>
                {g.daftar.map((t) => (
                  <option key={t.no} value={t.no}>{t.no}. {t.judul}</option>
                ))}
              </optgroup>
            ))}
          </select>
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
                  {i.jenis === 'tanggalJam' && <p className="help">Isi tanggal, jam, atau keduanya.</p>}
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
          <p className="help">Di komputer, WhatsApp Web terbuka di tab baru (harus sudah login). Di HP, aplikasi WhatsApp yang terbuka.</p>
          <p className="help">Tanda *teks* di WhatsApp tampil sebagai huruf tebal. Bagian bergaris biru adalah isian yang belum diisi.</p>

          <div className="btn-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn" style={{ flex: '1 1 100%' }} onClick={kirim} disabled={pesan.kosong.length > 0}>
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
