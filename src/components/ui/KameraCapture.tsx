'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CircleAlert, RefreshCw, RotateCcw, X, Check } from 'lucide-react';
import { barisStempel, namaBerkasFoto, ukuranKeluaran } from '@/lib/foto-kamera/stempel';

/* Kamera dalam halaman (getUserMedia) — SATU-SATUNYA jalan foto masuk untuk field
   ber-`kamera`. Tidak ada input file, jadi foto tidak bisa dipilih dari galeri/album.
   Stempel (waktu WIB + nama) digambar ke foto saat rana ditekan, lalu hasilnya
   dikirim sebagai File JPEG yang sudah muat batas 2 MB. */

const MAKS_BYTE = 1.9 * 1024 * 1024;

function pesanGalat(e: unknown): string {
  const nama = (e as { name?: string })?.name;
  if (nama === 'NotAllowedError' || nama === 'SecurityError')
    return 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, lalu coba lagi.';
  if (nama === 'NotFoundError' || nama === 'OverconstrainedError') return 'Kamera tidak ditemukan di perangkat ini.';
  if (nama === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.';
  return 'Kamera tidak bisa dibuka. Coba muat ulang halaman.';
}

function canvasKeBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  const coba = (q: number): Promise<Blob | null> =>
    new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', q));
  return (async () => {
    let blob: Blob | null = null;
    for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
      blob = await coba(q);
      if (blob && blob.size <= MAKS_BYTE) return blob;
    }
    return blob;
  })();
}

/** Gambar stempel di pojok kiri bawah: kotak gelap transparan + teks putih. */
function gambarStempel(ctx: CanvasRenderingContext2D, w: number, h: number, baris: string[]) {
  const font = Math.max(16, Math.round(Math.min(w, h) * 0.034));
  const pad = Math.round(font * 0.6);
  const tinggiBaris = Math.round(font * 1.3);
  ctx.font = `600 ${font}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'top';
  const lebarTeks = Math.max(...baris.map((t) => ctx.measureText(t).width));
  const kotakW = Math.min(w - pad, Math.ceil(lebarTeks) + pad * 2);
  const kotakH = tinggiBaris * baris.length + pad * 2 - (tinggiBaris - font);
  const x = pad;
  const y = h - kotakH - pad;
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.beginPath();
  // roundRect belum ada di browser lama (Safari < 16) → kotak biasa.
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, kotakW, kotakH, Math.round(font * 0.4));
  else ctx.rect(x, y, kotakW, kotakH);
  ctx.fill();
  ctx.fillStyle = '#fff';
  baris.forEach((t, i) => ctx.fillText(t, x + pad, y + pad + i * tinggiBaris, kotakW - pad * 2));
}

export default function KameraCapture({
  nama,
  onSelesai,
  onTutup
}: {
  /** Nama pengunggah yang dicetak di stempel. */
  nama: string;
  onSelesai: (file: File) => void;
  onTutup: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hadap, setHadap] = useState<'environment' | 'user'>('environment');
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState('');
  const [hasil, setHasil] = useState<{ file: File; url: string } | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

  const matikan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (hasil) return; // kamera berhenti saat melihat hasil jepretan
    let batal = false;
    setSiap(false);
    setGalat('');
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setGalat('Kamera hanya bisa dipakai lewat koneksi aman (HTTPS) dan browser yang mendukung.');
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: hadap }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (batal) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => {});
        }
        setSiap(true);
      } catch (e) {
        if (!batal) setGalat(pesanGalat(e));
      }
    })();
    return () => {
      batal = true;
      matikan();
    };
  }, [hadap, hasil, percobaan, matikan]);

  // Kunci scroll halaman di belakang layar kamera.
  useEffect(() => {
    const awal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = awal;
    };
  }, []);

  useEffect(() => {
    if (!hasil) return;
    return () => URL.revokeObjectURL(hasil.url);
  }, [hasil]);

  async function jepret() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setMemproses(true);
    try {
      const waktu = new Date(); // waktu stempel = saat rana ditekan
      const { w, h } = ukuranKeluaran(v.videoWidth, v.videoHeight);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(v, 0, 0, w, h);
      gambarStempel(ctx, w, h, barisStempel(waktu, nama));
      const blob = await canvasKeBlob(c);
      if (!blob) throw new Error('blob');
      const file = new File([blob], namaBerkasFoto(waktu), { type: 'image/jpeg', lastModified: waktu.getTime() });
      setHasil({ file, url: URL.createObjectURL(file) });
    } catch {
      setGalat('Gagal memproses foto. Coba ambil lagi.');
    } finally {
      setMemproses(false);
    }
  }

  function tutup() {
    matikan();
    onTutup();
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="kamera" role="dialog" aria-modal="true" aria-label="Ambil foto">
      <button type="button" className="kamera__x" aria-label="Tutup kamera" onClick={tutup}>
        <X size={22} />
      </button>

      {hasil ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="kamera__layar" src={hasil.url} alt="Hasil foto berstempel" />
          <div className="kamera__bar">
            <button type="button" className="kamera__aksi" onClick={() => setHasil(null)}>
              <RotateCcw size={20} /> Ulangi
            </button>
            <button
              type="button"
              className="kamera__aksi kamera__aksi--utama"
              onClick={() => {
                onSelesai(hasil.file);
              }}
            >
              <Check size={20} /> Pakai foto
            </button>
          </div>
        </>
      ) : (
        <>
          <video ref={videoRef} className="kamera__layar" playsInline muted autoPlay />
          {galat && (
            <div className="kamera__galat" role="alert">
              <CircleAlert size={22} />
              <p>{galat}</p>
              <button type="button" className="kamera__aksi" onClick={() => setPercobaan((n) => n + 1)}>
                <RefreshCw size={18} /> Coba lagi
              </button>
            </div>
          )}
          <div className="kamera__bar">
            <span className="kamera__spasi" />
            <button
              type="button"
              className="kamera__rana"
              aria-label="Ambil foto"
              disabled={!siap || memproses}
              onClick={jepret}
            >
              <Camera size={26} />
            </button>
            <button
              type="button"
              className="kamera__balik"
              aria-label="Ganti kamera depan/belakang"
              onClick={() => setHadap((h) => (h === 'environment' ? 'user' : 'environment'))}
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
