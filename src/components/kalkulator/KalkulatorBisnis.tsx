'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save, CopyPlus, Trash2 } from 'lucide-react';
import { hitung, normalisasi } from '@/lib/kalkulator/hitung';
import { SKENARIO_DEFAULT } from '@/lib/kalkulator/default';
import type { SkenarioInput } from '@/lib/kalkulator/tipe';
import PanelInput from './PanelInput';
import HasilKalkulator, { RingkasHasil } from './HasilKalkulator';

interface Skenario {
  id: number;
  nama: string;
  data: SkenarioInput;
  diubah_pada: string;
}
type Pesan = { ok: boolean; teks: string } | null;

const API = '/api/dashboard/kalkulator';
const jejak = (nama: string, data: SkenarioInput) => JSON.stringify([nama, normalisasi(data)]);

async function panggil(method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<any> {
  const res = await fetch(API, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (${res.status})`);
  return j;
}

export default function KalkulatorBisnis() {
  const [input, setInput] = useState<SkenarioInput>(() => structuredClone(SKENARIO_DEFAULT));
  const [nama, setNama] = useState('Skenario baru');
  const [aktifId, setAktifId] = useState<number | null>(null);
  const [daftar, setDaftar] = useState<Skenario[]>([]);
  const [tersimpan, setTersimpan] = useState(() => jejak('Skenario baru', SKENARIO_DEFAULT));
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<Pesan>(null);

  const h = useMemo(() => hitung(input), [input]);
  const berubah = jejak(nama, input) !== tersimpan;

  const ubah = useCallback((f: (d: SkenarioInput) => void) => {
    setInput((prev) => {
      const d = structuredClone(prev);
      f(d);
      return d;
    });
  }, []);

  const muatDaftar = useCallback(async () => {
    try {
      const j = await panggil('GET');
      setDaftar(j.skenario as Skenario[]);
    } catch (e) {
      setPesan({ ok: false, teks: `Daftar skenario tidak bisa dimuat: ${(e as Error).message}` });
    }
  }, []);

  useEffect(() => {
    void muatDaftar();
  }, [muatDaftar]);

  useEffect(() => {
    if (!berubah) return;
    const tahan = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [berubah]);

  const terapkan = (n: string, data: SkenarioInput, id: number | null) => {
    setNama(n);
    setInput(structuredClone(data));
    setAktifId(id);
    setTersimpan(jejak(n, data));
  };

  const pilih = (v: string) => {
    if (berubah && !window.confirm('Perubahan belum disimpan akan hilang. Lanjutkan?')) return;
    setPesan(null);
    const s = daftar.find((x) => String(x.id) === v);
    if (s) terapkan(s.nama, s.data, s.id);
    else terapkan('Skenario baru', SKENARIO_DEFAULT, null);
  };

  const simpan = async (sebagaiBaru: boolean) => {
    const n = nama.trim() || 'Skenario baru';
    const data = normalisasi(input);
    setSibuk(true);
    setPesan(null);
    try {
      if (aktifId !== null && !sebagaiBaru) {
        await panggil('PUT', { id: aktifId, nama: n, data });
        terapkan(n, data, aktifId);
      } else {
        const namaBaru = sebagaiBaru && aktifId !== null && n === nama.trim() ? `${n} (salinan)`.slice(0, 80) : n;
        const j = await panggil('POST', { nama: namaBaru, data });
        terapkan(namaBaru, data, Number(j.id));
      }
      setPesan({ ok: true, teks: 'Skenario tersimpan.' });
      await muatDaftar();
    } catch (e) {
      setPesan({ ok: false, teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  const hapus = async () => {
    if (aktifId === null || !window.confirm(`Hapus skenario "${nama}"?`)) return;
    setSibuk(true);
    setPesan(null);
    try {
      await panggil('PUT', { id: aktifId, hapus: true });
      terapkan('Skenario baru', SKENARIO_DEFAULT, null);
      setPesan({ ok: true, teks: 'Skenario dihapus.' });
      await muatDaftar();
    } catch (e) {
      setPesan({ ok: false, teks: (e as Error).message });
    } finally {
      setSibuk(false);
    }
  };

  const reset = () => {
    if (!window.confirm('Kembalikan semua input ke nilai bawaan?')) return;
    setInput(structuredClone(SKENARIO_DEFAULT));
  };

  return (
    <div className="view kalk">
      <section className="card kalk-bar">
        <div className="kalk-bar__fields">
          <label className="kalk-field">
            <span className="kalk-field__label">Skenario</span>
            <select value={aktifId ?? ''} onChange={(e) => pilih(e.target.value)} disabled={sibuk}>
              <option value="">— Skenario baru —</option>
              {daftar.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="kalk-field">
            <span className="kalk-field__label">Nama</span>
            <input type="text" maxLength={80} value={nama} onChange={(e) => setNama(e.target.value)} />
          </label>
        </div>
        <div className="kalk-bar__aksi">
          {berubah && <span className="kalk-dirty">Belum disimpan</span>}
          <button type="button" className="kalk-btn" disabled={sibuk} onClick={() => simpan(false)}>
            <Save size={15} aria-hidden /> Simpan
          </button>
          <button type="button" className="kalk-btn ghost" disabled={sibuk} onClick={() => simpan(true)}>
            <CopyPlus size={15} aria-hidden /> Simpan sebagai baru
          </button>
          <button type="button" className="kalk-btn ghost" disabled={sibuk} onClick={reset}>
            <RotateCcw size={15} aria-hidden /> Nilai bawaan
          </button>
          {aktifId !== null && (
            <button type="button" className="kalk-btn danger" disabled={sibuk} onClick={hapus}>
              <Trash2 size={15} aria-hidden /> Hapus
            </button>
          )}
        </div>
        <p role="status" className={pesan ? (pesan.ok ? 'kalk-ok' : 'kalk-err') : 'kalk-status-kosong'}>
          {pesan?.teks}
        </p>
      </section>

      <RingkasHasil h={h} />
      <div className="kalk-layout">
        <PanelInput input={input} ubah={ubah} h={h} />
        <HasilKalkulator h={h} upgradeAktif={input.upgrade.aktif} />
      </div>
    </div>
  );
}
