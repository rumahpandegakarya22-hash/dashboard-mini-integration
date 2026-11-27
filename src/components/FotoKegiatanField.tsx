'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CircleAlert, ImageOff, LoaderCircle, Plus, X } from 'lucide-react';
import KameraCapture from '@/components/ui/KameraCapture';
import { useNamaPengunggah } from '@/components/PengunggahContext';
import { MAKS_FOTO, serialisasiFoto, type FotoKegiatan } from '@/lib/kegiatan-cleaning/foto';
import type { FieldDef } from '@/lib/modules/types';

/* Banyak foto dalam satu entri, tiap foto bertanda jenis kegiatan.
   Alur: ketuk chip kegiatan → kamera → foto berstempel → unggah ke Drive → muncul di grid.
   Nilai field = string JSON daftar {jenis, url} (lihat lib/kegiatan-cleaning/foto.ts). */

interface Item extends FotoKegiatan {
  key: string;
  preview?: string; // object URL pratinjau (tidak ada untuk draft yang dipulihkan)
  busy?: boolean;
}

const unik = () => Math.random().toString(36).slice(2);

function pulihkan(value: string): Item[] {
  try {
    const a = JSON.parse(value);
    return Array.isArray(a)
      ? a
          .filter((x) => x && typeof x.jenis === 'string' && typeof x.url === 'string')
          .map((x) => ({ key: unik(), jenis: x.jenis, url: x.url }))
      : [];
  } catch {
    return [];
  }
}

export default function FotoKegiatanField({
  f,
  value,
  onChange
}: {
  f: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const nama = useNamaPengunggah();
  const jenisList = (f.options ?? []).map((o) => o.value);
  const maks = f.maxFoto ?? MAKS_FOTO;
  const [items, setItems] = useState<Item[]>(() => pulihkan(value));
  const itemsRef = useRef(items);
  const [kameraUntuk, setKameraUntuk] = useState<string | null>(null);
  const [lainnyaBuka, setLainnyaBuka] = useState(false);
  const [lainnya, setLainnya] = useState('');
  const [galat, setGalat] = useState('');

  // Nilai berubah dari luar (draft dimuat setelah render pertama, atau form direset
  // setelah simpan) → daftar foto mengikuti nilainya.
  useEffect(() => {
    const ada = itemsRef.current;
    if (ada.some((i) => i.busy)) return;
    if (value === serialisasiFoto(ada.filter((i) => i.url))) return;
    ada.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
    const baru = pulihkan(value);
    itemsRef.current = baru;
    setItems(baru);
  }, [value]);

  function terapkan(next: Item[]) {
    itemsRef.current = next;
    setItems(next);
    onChange(serialisasiFoto(next.filter((i) => i.url && !i.busy)));
  }

  async function unggah(jenis: string, file: File) {
    setGalat('');
    const key = unik();
    const preview = URL.createObjectURL(file);
    terapkan([...itemsRef.current, { key, jenis, url: '', preview, busy: true }]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', f.uploadKind || '');
      const res = await fetch('/api/ops/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || 'Unggah foto gagal.');
      terapkan(itemsRef.current.map((i) => (i.key === key ? { ...i, url: String(json.url), busy: false } : i)));
    } catch (e) {
      URL.revokeObjectURL(preview);
      terapkan(itemsRef.current.filter((i) => i.key !== key));
      setGalat(e instanceof Error ? e.message : 'Unggah foto gagal.');
    }
  }

  function hapus(key: string) {
    const it = itemsRef.current.find((i) => i.key === key);
    if (it?.preview) URL.revokeObjectURL(it.preview);
    terapkan(itemsRef.current.filter((i) => i.key !== key));
  }

  const penuh = items.length >= maks;
  const jumlah = (j: string) => items.filter((i) => i.jenis === j).length;
  const sibuk = items.some((i) => i.busy);

  return (
    <div className="foto-keg">
      <div className="foto-keg__chips" role="group" aria-label="Pilih kegiatan lalu ambil foto">
        {jenisList.map((j) => (
          <button
            key={j}
            type="button"
            className="foto-keg__chip"
            disabled={penuh}
            onClick={() => setKameraUntuk(j)}
          >
            <Camera size={16} aria-hidden /> {j}
            {jumlah(j) > 0 && <span className="jml">{jumlah(j)}</span>}
          </button>
        ))}
        <button
          type="button"
          className="foto-keg__chip"
          disabled={penuh}
          aria-expanded={lainnyaBuka}
          onClick={() => setLainnyaBuka((b) => !b)}
        >
          <Plus size={16} aria-hidden /> Lainnya
        </button>
      </div>

      {lainnyaBuka && (
        <div className="foto-keg__lainnya">
          <input
            type="text"
            value={lainnya}
            maxLength={40}
            placeholder="Nama kegiatan, mis. Cuci karpet"
            aria-label="Nama kegiatan lainnya"
            onChange={(e) => setLainnya(e.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={penuh || !lainnya.trim()}
            onClick={() => setKameraUntuk(lainnya.trim())}
          >
            <Camera size={16} aria-hidden /> Foto
          </button>
        </div>
      )}

      <p className="help" style={{ margin: 0 }}>
        Ketuk kegiatan, lalu foto langsung dengan kamera (maks {maks} foto). Foto otomatis diberi stempel tanggal, jam WIB, dan nama kamu.
        {sibuk ? ' Mengunggah…' : ''}
      </p>

      {galat && (
        <div className="banner error" role="alert">
          <CircleAlert size={16} />
          <span>{galat}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="foto-keg__grid">
          {items.map((i) => (
            <figure key={i.key} className="foto-keg__item" style={{ margin: 0 }}>
              {i.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.preview} alt={`Foto ${i.jenis}`} />
              ) : (
                <div style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center' }} aria-label={`Foto ${i.jenis} (sudah terunggah)`}>
                  <ImageOff size={22} aria-hidden />
                </div>
              )}
              <figcaption className="foto-keg__cap">{i.jenis}</figcaption>
              {i.busy ? (
                <span className="foto-keg__busy" aria-label="Mengunggah">
                  <LoaderCircle size={22} className="spin" />
                </span>
              ) : (
                <button type="button" className="foto-keg__hapus" aria-label={`Hapus foto ${i.jenis}`} onClick={() => hapus(i.key)}>
                  <X size={16} />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {kameraUntuk && (
        <KameraCapture
          nama={nama}
          onTutup={() => setKameraUntuk(null)}
          onSelesai={(file) => {
            const j = kameraUntuk;
            setKameraUntuk(null);
            setLainnya('');
            setLainnyaBuka(false);
            void unggah(j, file);
          }}
        />
      )}
    </div>
  );
}
