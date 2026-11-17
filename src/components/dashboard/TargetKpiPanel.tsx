'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFINISI_TARGET, DIVISI_LABEL, bolehUbahTarget, divisiTerlihat, type TargetMap } from '@/lib/dashboard/targets';

/** Halaman pengaturan target KPI. Owner mengatur semua divisi, kepala divisi hanya divisinya, Pengawas hanya melihat. */
export default function TargetKpiPanel({ role, kepala, nilai }: { role: string; kepala: boolean; nilai: TargetMap }) {
  const router = useRouter();
  const [isi, setIsi] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEFINISI_TARGET.map((t) => [t.kunci, String(nilai[t.kunci] ?? t.nilaiBawaan)]))
  );
  const [pesan, setPesan] = useState<Record<string, { ok: boolean; teks: string }>>({});
  const [sibuk, setSibuk] = useState<string | null>(null);

  async function kirim(kunci: string, nilaiBaru: number | null) {
    setSibuk(kunci);
    try {
      const res = await fetch('/api/dashboard/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kunci, nilai: nilaiBaru })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan.');
      setIsi((p) => ({ ...p, [kunci]: String(j.nilai) }));
      setPesan((p) => ({ ...p, [kunci]: { ok: true, teks: j.bawaan ? 'Kembali ke bawaan' : 'Tersimpan' } }));
      router.refresh();
    } catch (e) {
      setPesan((p) => ({ ...p, [kunci]: { ok: false, teks: (e as Error).message } }));
    } finally {
      setSibuk(null);
    }
  }

  const bisaUbahApa = divisiTerlihat(role).some((d) => bolehUbahTarget(role, d, kepala));

  return (
    <div className="view">
      <p className="target-intro">
        Target dipakai sebagai keterangan dan bar pencapaian di kartu dashboard.{' '}
        {bisaUbahApa
          ? 'Ubah angkanya lalu tekan Simpan; tombol Bawaan mengembalikan ke nilai SOW.'
          : 'Anda hanya dapat melihat target; perubahan dilakukan Owner atau kepala divisi (akun yang ditandai Owner).'}
      </p>
      {divisiTerlihat(role).map((div) => {
        const boleh = bolehUbahTarget(role, div, kepala);
        return (
          <section className="card target-card" key={div}>
            <div className="card__title">
              {DIVISI_LABEL[div]}
              {!boleh && <span className="target-ro">hanya lihat</span>}
            </div>
            <div className="target-list">
              {DEFINISI_TARGET.filter((t) => t.divisi === div).map((t) => {
                const berubah = Number(isi[t.kunci].replace(',', '.')) !== (nilai[t.kunci] ?? t.nilaiBawaan);
                const m = pesan[t.kunci];
                return (
                  <div className="target-row" key={t.kunci}>
                    <label htmlFor={`t-${t.kunci}`}>
                      {t.label}
                      <small>{t.arah === 'max' ? 'batas atas (makin rendah makin baik)' : 'makin tinggi makin baik'}</small>
                    </label>
                    <div className="target-input">
                      <input
                        id={`t-${t.kunci}`}
                        type="text"
                        inputMode="decimal"
                        value={isi[t.kunci]}
                        disabled={!boleh}
                        onChange={(e) => setIsi((p) => ({ ...p, [t.kunci]: e.target.value }))}
                      />
                      <span className="target-unit">{t.satuan}</span>
                    </div>
                    {boleh ? (
                      <div className="target-aksi">
                        <button
                          type="button"
                          className="target-btn"
                          disabled={!berubah || sibuk === t.kunci}
                          onClick={() => kirim(t.kunci, Number(isi[t.kunci].replace(',', '.')))}
                        >
                          Simpan
                        </button>
                        <button type="button" className="target-btn ghost" disabled={sibuk === t.kunci} onClick={() => kirim(t.kunci, null)}>
                          Bawaan ({t.nilaiBawaan.toLocaleString('id-ID')})
                        </button>
                        {m && <span className={m.ok ? 'target-ok' : 'target-err'}>{m.teks}</span>}
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
