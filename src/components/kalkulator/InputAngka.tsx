'use client';

import { useId, useState } from 'react';
import { angkaId, bacaAngka } from '@/lib/kalkulator/format';

export interface InputAngkaProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  step?: number;
  /** Batas atas slider bila beda dari max input (mis. harga: slider 0–5 jt, ketik sampai 1e10). */
  sliderMax?: number;
  slider?: boolean;
  rupiah?: boolean;
  satuan?: string;
  bantuan?: string;
}

const jepit = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Slider + kotak angka yang selalu sinkron. Saat diketik tampil mentah, saat lepas fokus tampil format id-ID. */
export default function InputAngka({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  sliderMax,
  slider = false,
  rupiah = false,
  satuan,
  bantuan
}: InputAngkaProps) {
  const id = useId();
  const [ketik, setKetik] = useState<string | null>(null);
  const tampil = ketik ?? (rupiah ? `Rp${angkaId(value, 0)}` : angkaId(value));
  const sMax = Math.max(sliderMax ?? max, value);

  return (
    <div className="kalk-field">
      <label htmlFor={id} className="kalk-field__label">
        {label}
        {bantuan && <small>{bantuan}</small>}
      </label>
      <div className="kalk-field__row">
        {slider && (
          <input
            type="range"
            className="kalk-range"
            aria-label={label}
            min={min}
            max={sMax}
            step={step}
            value={jepit(value, min, sMax)}
            onChange={(e) => onChange(jepit(Number(e.target.value), min, max))}
          />
        )}
        <span className="kalk-num">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={tampil}
            onFocus={(e) => {
              setKetik(String(value).replace('.', ','));
              requestAnimationFrame(() => e.target.select());
            }}
            onChange={(e) => {
              setKetik(e.target.value);
              onChange(jepit(bacaAngka(e.target.value), min, max));
            }}
            onBlur={() => setKetik(null)}
          />
          {satuan && <span className="kalk-num__unit">{satuan}</span>}
        </span>
      </div>
    </div>
  );
}
