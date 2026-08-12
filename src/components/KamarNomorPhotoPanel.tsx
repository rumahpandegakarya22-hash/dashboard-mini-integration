'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import LandingPhotoManager from './LandingPhotoManager';

interface KamarRow { no_kamar: number; tipe_kamar: string; foto: number; }

export default function KamarNomorPhotoPanel() {
  const [kamar, setKamar] = useState<KamarRow[] | null>(null);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ops/landing-page/kamar-list');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat daftar kamar.');
        setKamar(json.kamar ?? []);
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="banner error"><CircleAlert size={16} /> {err}</div>;
  if (kamar === null) return <p className="muted"><LoaderCircle size={16} className="spin" style={{ marginRight: 6 }} />Memuat daftar kamar…</p>;

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Pilih nomor kamar untuk mengelola foto-fotonya (slideshow + cover). Angka di badge = jumlah foto tersimpan.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {kamar.map((k) => (
          <button
            key={k.no_kamar}
            type="button"
            onClick={() => setSelected(selected === k.no_kamar ? null : k.no_kamar)}
            className={selected === k.no_kamar ? 'btn' : 'btn secondary'}
            style={{ padding: '6px 12px', position: 'relative' }}
            title={`Kamar ${k.no_kamar} · ${k.tipe_kamar}`}
          >
            {k.no_kamar}
            {k.foto > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: 'var(--brand)', color: '#fff', borderRadius: 999, padding: '1px 6px' }}>
                {k.foto}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected !== null ? (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Foto Kamar No. {selected} — cover &amp; urutan slide
          </h3>
          <LandingPhotoManager scope="kamar" noKamar={selected} />
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>Belum ada nomor kamar dipilih.</p>
      )}
    </div>
  );
}
