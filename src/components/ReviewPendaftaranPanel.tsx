'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, ClipboardCheck, LoaderCircle, Paperclip } from 'lucide-react';

interface Pendaftar {
  noBooking: string;
  status: string;
  tanggalDaftar: string;
  identitas: { namaLengkap: string; namaPanggilan: string; email: string; noHp: string; asalDaerah: string };
  hunian: { noKamar: string; rencanaMasuk: string; durasiBulan: number; hargaDisepakati: number };
  aktivitas: { pekerjaan: string; institusi: string; programStudi: string };
  darurat: { nama: string; nomor: string; relasi: string }[];
  barang: { jumlahGadget: number; elektronik: string };
  berkas: { identitas: string | null; buktiDp: string | null };
  alasanBatal: string;
}

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

function Baris({ label, nilai }: { label: string; nilai: string }) {
  if (!nilai) return null;
  return (
    <div className="receipt-row">
      <span className="receipt-label">{label}</span>
      <span className="receipt-value">{nilai}</span>
    </div>
  );
}

/**
 * Review pendaftaran mandiri dari aplikasi Teman Rara. Menampilkan data diri
 * lengkap yang selama ini hanya ada di tabel `tr_pendaftaran` dan tidak pernah
 * muncul di layar mana pun.
 *
 * Konfirmasi di sini BUKAN check-in — statusnya berhenti di 'Konfirmasi'.
 * Check-in tetap lewat alurnya sendiri karena memicu pembentukan data penghuni.
 */
export default function ReviewPendaftaranPanel() {
  const [data, setData] = useState<Pendaftar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [semua, setSemua] = useState(false);
  const [alasan, setAlasan] = useState<Record<string, string>>({});
  // Tambahan listrik dari barang elektronik penghuni — dicatat saat review,
  // disalin ke penghuni saat check-in.
  const [listrik, setListrik] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load(filterSemua = semua) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/pendaftaran${filterSemua ? '?filter=semua' : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat pendaftaran.');
      setData(json.data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat pendaftaran.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function proses(p: Pendaftar, aksi: 'konfirmasi' | 'tolak') {
    setBusy(p.noBooking);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/pendaftaran', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noBooking: p.noBooking,
          aksi,
          alasan: alasan[p.noBooking] ?? '',
          tambahanListrik: Number(listrik[p.noBooking] ?? 0) || 0
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses.');
      setInfo(
        aksi === 'konfirmasi'
          ? `Pendaftaran ${p.identitas.namaLengkap} dikonfirmasi. Check-in tetap dicatat lewat alurnya sendiri saat penghuni benar-benar masuk.`
          : `Pendaftaran ${p.identitas.namaLengkap} dibatalkan.`
      );
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal memproses.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Review Pendaftaran" style={{ marginTop: 28 }}>
      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClipboardCheck size={16} /> Review Pendaftaran Mandiri
        {data && <span className="count-badge">{data.length}</span>}
      </h2>

      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="banner info" role="status" style={{ marginBottom: 12 }}>
          <span>{info}</span>
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={semua ? 'btn secondary' : 'btn'}
          onClick={() => {
            setSemua(false);
            load(false);
          }}
        >
          Menunggu Review
        </button>
        <button
          type="button"
          className={semua ? 'btn' : 'btn secondary'}
          onClick={() => {
            setSemua(true);
            load(true);
          }}
        >
          Semua
        </button>
      </div>

      {loading && (
        <div className="card" aria-busy="true" aria-label="Memuat pendaftaran">
          <div className="skeleton" style={{ height: 20, width: '45%' }} />
          <div className="skeleton" style={{ height: 96, marginTop: 14 }} />
        </div>
      )}

      {!loading && data?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {semua
              ? 'Belum ada pendaftaran mandiri lewat aplikasi Teman Rara.'
              : 'Tidak ada pendaftaran yang menunggu review.'}
          </p>
        </div>
      )}

      <div className="panel-grid">
        {!loading &&
          data?.map((p) => (
          <div key={p.noBooking} className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span className={p.status === 'Pending' ? 'prio-badge hot' : 'prio-badge'}>{p.status}</span>
              <span className="muted" style={{ fontSize: '0.8125rem' }}>
                {p.noBooking} · daftar {p.tanggalDaftar}
              </span>
            </div>

            <h3 style={{ fontSize: '1rem', margin: '8px 0 10px' }}>
              {p.identitas.namaLengkap}
              {p.identitas.namaPanggilan && ` (${p.identitas.namaPanggilan})`}
            </h3>

            <div className="receipt">
              <Baris label="Kamar" nilai={`K-${p.hunian.noKamar}`} />
              <Baris label="Rencana masuk" nilai={p.hunian.rencanaMasuk} />
              <Baris
                label="Durasi & harga"
                nilai={
                  p.hunian.durasiBulan
                    ? `${p.hunian.durasiBulan} bulan · ${rupiah(p.hunian.hargaDisepakati)}`
                    : rupiah(p.hunian.hargaDisepakati)
                }
              />
              <Baris label="Email" nilai={p.identitas.email} />
              <Baris label="No. HP" nilai={p.identitas.noHp} />
              <Baris label="Asal daerah" nilai={p.identitas.asalDaerah} />
              <Baris
                label={p.aktivitas.pekerjaan || 'Aktivitas'}
                nilai={[p.aktivitas.institusi, p.aktivitas.programStudi].filter((v) => v && v !== '-').join(' — ')}
              />
              <Baris
                label="Barang bawaan"
                nilai={[
                  p.barang.jumlahGadget ? `${p.barang.jumlahGadget} gadget` : '',
                  p.barang.elektronik
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </div>

            {p.darurat.length > 0 && (
              <>
                <p className="muted" style={{ fontSize: '0.8125rem', margin: '12px 0 4px' }}>
                  Kontak darurat
                </p>
                <div className="receipt">
                  {p.darurat.map((d, i) => (
                    <Baris key={`${i}-${d.nomor}`} label={`${d.nama} (${d.relasi})`} nilai={d.nomor} />
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {p.berkas.identitas && (
                <a href={p.berkas.identitas} target="_blank" rel="noreferrer" className="btn-plain">
                  <Paperclip size={16} />
                  Scan identitas
                </a>
              )}
              {p.berkas.buktiDp && (
                <a href={p.berkas.buktiDp} target="_blank" rel="noreferrer" className="btn-plain">
                  <Paperclip size={16} />
                  Bukti DP
                </a>
              )}
            </div>

            {p.alasanBatal && (
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>
                Alasan pembatalan: {p.alasanBatal}
              </p>
            )}

            {p.status === 'Pending' && (
              <>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor={`listrik-${p.noBooking}`}>Tambahan Listrik / bulan (Rp)</label>
                  <input
                    id={`listrik-${p.noBooking}`}
                    type="number"
                    min={0}
                    value={listrik[p.noBooking] ?? ''}
                    placeholder="Kosongkan kalau tidak bawa barang elektronik"
                    onChange={(e) => setListrik((prev) => ({ ...prev, [p.noBooking]: e.target.value }))}
                  />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor={`tolak-${p.noBooking}`}>Alasan penolakan</label>
                  <input
                    id={`tolak-${p.noBooking}`}
                    maxLength={500}
                    value={alasan[p.noBooking] ?? ''}
                    placeholder="Wajib diisi kalau pendaftaran ditolak"
                    onChange={(e) => setAlasan((prev) => ({ ...prev, [p.noBooking]: e.target.value }))}
                  />
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy === p.noBooking}
                    onClick={() => proses(p, 'konfirmasi')}
                  >
                    {busy === p.noBooking && <LoaderCircle size={18} className="spin" />}
                    Konfirmasi
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy === p.noBooking || (alasan[p.noBooking] ?? '').trim().length < 5}
                    onClick={() => proses(p, 'tolak')}
                  >
                    Tolak
                  </button>
                </div>
              </>
            )}
          </div>
          ))}
      </div>
    </section>
  );
}
