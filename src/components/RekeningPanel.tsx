'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { barisRekening, validasiRekening, type Rekening } from '@/lib/pengingat/rekening';
import { fmtWaktu } from '@/lib/format-tanggal';

const KOSONG: Rekening = { bank: '', nomor: '', atasNama: '' };
const KOLOM: { kunci: keyof Rekening; label: string; angka?: true }[] = [
  { kunci: 'bank', label: 'Nama bank' },
  { kunci: 'nomor', label: 'Nomor rekening', angka: true },
  { kunci: 'atasNama', label: 'Atas nama' }
];

interface Data {
  rekening: Rekening | null;
  olehSiapa: string | null;
  kapan: string | null;
  error?: string;
}

export default function RekeningPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [isian, setIsian] = useState<Rekening>(KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: 'error' | 'info'; teks: string } | null>(null);

  const gagal = (e: unknown, cadangan: string) => setPesan({ jenis: 'error', teks: e instanceof Error ? e.message : cadangan });

  async function minta(init?: RequestInit): Promise<Data> {
    const res = await fetch('/api/ops/admin/rekening', init);
    const json = (await res.json()) as Data;
    if (!res.ok) throw new Error(json.error ?? 'Permintaan gagal.');
    return json;
  }

  function terapkan(d: Data) {
    setData(d);
    setIsian(d.rekening ?? KOSONG);
  }

  useEffect(() => {
    minta().then(terapkan).catch((e: unknown) => gagal(e, 'Gagal memuat rekening.'));
  }, []);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setPesan(null);
    try {
      const baru = validasiRekening(isian);
      if (!window.confirm(`Draft tagihan akan memakai rekening ini:\n\n${barisRekening(baru)}\n\nSimpan?`)) return;
      setMenyimpan(true);
      terapkan(await minta({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(baru) }));
      setPesan({ jenis: 'info', teks: 'Rekening disimpan.' });
    } catch (err: unknown) {
      gagal(err, 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  }

  const berubah = KOLOM.some((k) => isian[k.kunci] !== (data?.rekening?.[k.kunci] ?? ''));

  return (
    <div className="form-col" style={{ maxWidth: 480 }}>
      {pesan && (
        <div className={`banner ${pesan.jenis}`} role={pesan.jenis === 'error' ? 'alert' : 'status'}>
          <span>{pesan.teks}</span>
        </div>
      )}

      {!data && !pesan && (
        <div className="card" aria-busy="true">
          <div className="skeleton" style={{ height: 20, width: '50%' }} />
        </div>
      )}

      {data && (
        <form className="card" onSubmit={simpan}>
          {!data.rekening && (
            <div className="banner warn" role="status" style={{ marginTop: 0, marginBottom: 12 }}>
              <span>Rekening belum diatur. Tombol WhatsApp di beranda nonaktif sampai diisi.</span>
            </div>
          )}
          {KOLOM.map((k) => (
            <div className="field" key={k.kunci}>
              <label htmlFor={`rek-${k.kunci}`}>{k.label}</label>
              <input
                id={`rek-${k.kunci}`}
                type="text"
                inputMode={k.angka ? 'numeric' : 'text'}
                maxLength={80}
                required
                value={isian[k.kunci]}
                onChange={(e) => setIsian((s) => ({ ...s, [k.kunci]: e.target.value }))}
              />
            </div>
          ))}
          <button type="submit" className="btn" disabled={menyimpan || !berubah}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </button>
          {data.olehSiapa && (
            <p className="help">Terakhir diubah oleh {data.olehSiapa}, {fmtWaktu(data.kapan)} WIB.</p>
          )}
        </form>
      )}
    </div>
  );
}
