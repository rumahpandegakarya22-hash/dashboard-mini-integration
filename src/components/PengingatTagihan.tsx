'use client';

import { useEffect, useState } from 'react';
import { AlarmClock, BellRing, CircleAlert, MessageCircle, TriangleAlert, type LucideIcon } from 'lucide-react';
import { perangkatSeluler, tautanWhatsApp } from '@/lib/draft-info/render';
import { JUDUL_TAHAP, URUTAN_TAHAP, type Tahap } from '@/lib/pengingat/tagihan';

export interface KartuTagihan {
  id: string;
  nama: string;
  noKamar: string;
  tipe: string;
  jatuhTempo: string;
  keterangan: string;
  /** Format 62…; '' bila nomor tidak valid. */
  nomor: string;
  /** null = rekening belum diatur. */
  draft: string | null;
}

const TAMPILAN: Record<Tahap, { ikon: LucideIcon; rentang: string }> = {
  terlambat: { ikon: TriangleAlert, rentang: 'Lewat 7 hari atau lebih' },
  jatuh_tempo: { ikon: AlarmClock, rentang: 'Hari ini sampai lewat 6 hari' },
  pengingat: { ikon: BellRing, rentang: '1–3 hari lagi' }
};

/** `daftar` null = gagal dibaca. */
export default function PengingatTagihan({ daftar }: { daftar: Record<Tahap, KartuTagihan[]> | null }) {
  // Render server memakai tautan HP; komputer diarahkan ke WhatsApp Web setelah mount.
  const [seluler, setSeluler] = useState(true);
  useEffect(() => setSeluler(perangkatSeluler(navigator.userAgent, navigator.maxTouchPoints)), []);

  if (!daftar) {
    return (
      <div className="banner error" role="alert">
        <CircleAlert size={16} />
        <span>Pengingat jatuh tempo gagal dimuat. Muat ulang halaman; jangan anggap tidak ada tagihan.</span>
      </div>
    );
  }
  const rekeningKosong = URUTAN_TAHAP.some((t) => daftar[t].some((k) => k.draft === null));

  return (
    <div className="tagihan">
      {rekeningKosong && (
        <div className="banner warn" role="status">
          <CircleAlert size={16} />
          <span>Rekening pembayaran belum diatur. Minta Owner mengisinya di Pengaturan &gt; Rekening Pembayaran.</span>
        </div>
      )}
      {URUTAN_TAHAP.map((tahap) => {
        const { ikon: Ikon, rentang } = TAMPILAN[tahap];
        const isi = daftar[tahap];
        return (
          <section key={tahap} className={`card tagihan-seksi ${tahap}`} aria-labelledby={`tagihan-${tahap}`}>
            <header className="tagihan-kepala">
              <Ikon size={20} aria-hidden />
              <div>
                <h2 id={`tagihan-${tahap}`}>{JUDUL_TAHAP[tahap]}</h2>
                <p>{rentang}</p>
              </div>
              <span className="tagihan-jumlah" aria-label={`${isi.length} penghuni`}>{isi.length}</span>
            </header>

            {isi.length === 0 ? (
              <p className="muted tagihan-kosong">Tidak ada</p>
            ) : (
              <ul>
                {isi.map((k) => (
                  <li key={k.id}>
                    <div className="tagihan-info">
                      <strong>{k.nama}</strong>
                      <span>Kamar {k.noKamar}{k.tipe && ` · ${k.tipe}`}</span>
                      <span>Jatuh tempo {k.jatuhTempo} · <b>{k.keterangan}</b></span>
                    </div>
                    {k.draft && k.nomor ? (
                      <a
                        className="tagihan-wa"
                        href={tautanWhatsApp(k.draft, seluler, k.nomor)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Kirim tagihan ke ${k.nama} lewat WhatsApp`}
                      >
                        <MessageCircle size={18} aria-hidden /> WhatsApp
                      </a>
                    ) : (
                      <span className="tagihan-nonaktif">{k.nomor ? 'Rekening belum diatur' : 'Nomor HP belum diisi'}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
