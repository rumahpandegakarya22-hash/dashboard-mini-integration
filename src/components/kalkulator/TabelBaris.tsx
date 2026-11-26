'use client';

import { Plus, Trash2 } from 'lucide-react';
import InputAngka from './InputAngka';

export const MAKS_BARIS = 50;

export type Kolom<T> =
  | { kunci: keyof T & string; label: string; jenis: 'teks' }
  | { kunci: keyof T & string; label: string; jenis: 'angka'; min?: number; max: number; step?: number; rupiah?: boolean; satuan?: string }
  | { kunci: keyof T & string; label: string; jenis: 'cek' }
  | { kunci: keyof T & string; label: string; jenis: 'sifat' };

/** Daftar baris yang bisa diubah, ditambah, dan dihapus. Tiap sel berlabel sendiri sehingga rapi di HP. */
export default function TabelBaris<T extends object>({
  baris,
  kolom,
  onUbah,
  buatBaru,
  labelTambah,
  info
}: {
  baris: T[];
  kolom: Kolom<T>[];
  onUbah: (baris: T[]) => void;
  buatBaru: () => T;
  labelTambah: string;
  /** Teks hasil per baris, mis. "Rp12.345/bln". */
  info?: (b: T) => string;
}) {
  const set = (i: number, kunci: string, v: unknown) => onUbah(baris.map((b, j) => (j === i ? { ...b, [kunci]: v } : b)));

  return (
    <div className="kalk-rows">
      {baris.length === 0 && <p className="kalk-muted">Belum ada baris.</p>}
      {baris.map((b, i) => (
        <div className={`kalk-row${(b as { aktif?: boolean }).aktif === false ? ' is-off' : ''}`} key={i}>
          {kolom.map((k) => {
            const v = (b as Record<string, unknown>)[k.kunci];
            if (k.jenis === 'teks')
              return (
                <label className="kalk-cell kalk-cell--teks" key={k.kunci}>
                  <span>{k.label}</span>
                  <input type="text" maxLength={80} value={String(v ?? '')} onChange={(e) => set(i, k.kunci, e.target.value)} />
                </label>
              );
            if (k.jenis === 'cek')
              return (
                <label className="kalk-cell kalk-cell--cek" key={k.kunci}>
                  <input type="checkbox" checked={!!v} onChange={(e) => set(i, k.kunci, e.target.checked)} />
                  <span>{k.label}</span>
                </label>
              );
            if (k.jenis === 'sifat')
              return (
                <label className="kalk-cell" key={k.kunci}>
                  <span>{k.label}</span>
                  <select value={String(v)} onChange={(e) => set(i, k.kunci, e.target.value)}>
                    <option value="tetap">Tetap</option>
                    <option value="variabel">Variabel</option>
                  </select>
                </label>
              );
            return (
              <div className="kalk-cell" key={k.kunci}>
                <InputAngka
                  label={k.label}
                  value={Number(v) || 0}
                  onChange={(n) => set(i, k.kunci, n)}
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  rupiah={k.rupiah}
                  satuan={k.satuan}
                />
              </div>
            );
          })}
          {info && <span className="kalk-row__info">{info(b)}</span>}
          <button
            type="button"
            className="kalk-icon-btn"
            aria-label={`Hapus baris ${String((b as { nama?: string }).nama || i + 1)}`}
            onClick={() => onUbah(baris.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="kalk-btn ghost"
        disabled={baris.length >= MAKS_BARIS}
        onClick={() => onUbah([...baris, buatBaru()])}
      >
        <Plus size={15} aria-hidden /> {labelTambah}
      </button>
    </div>
  );
}
