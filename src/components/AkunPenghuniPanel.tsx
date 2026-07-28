'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, CircleAlert, LoaderCircle, UserRound, UserRoundX, UserRoundCheck } from 'lucide-react';
import Modal from './Modal';

interface Akun {
  idPenghuni: string;
  nama: string;
  noKamar: string;
  diklaim: string;
  dicabut: string | null;
  aktif: boolean;
  masihTinggal: boolean;
  ganda: boolean;
  yatim: boolean;
}

interface Ringkasan {
  akunAktif: number;
  akunDicabut: number;
  kamarTerisi: number;
  ganda: number;
  yatim: number;
}

/**
 * Monitor akun aplikasi penghuni. Dua hal yang dicari: satu kamar punya lebih
 * dari satu akun aktif, dan akun yang pemiliknya sudah check-out tapi belum
 * dicabut.
 *
 * Disajikan bento: layar ringkasan cukup menjawab "ada yang bermasalah?", dan
 * detail per akun dibuka di modal. Tombol Cabut/Pulihkan hanya ada di dalam
 * modal — mencabut akun memutus akses seseorang seketika, jadi tombolnya tidak
 * boleh berjajar puluhan di layar ringkasan tempat jempol sedang menggulir.
 */
export default function AkunPenghuniPanel() {
  const [data, setData] = useState<Akun[] | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [hanyaMasalah, setHanyaMasalah] = useState(false);
  const [terbuka, setTerbuka] = useState<string | null>(null);

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/ops/admin/akun-penghuni');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setData(json.data);
      setRingkasan(json.ringkasan);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function proses(a: Akun, aksi: 'cabut' | 'pulihkan') {
    if (aksi === 'cabut' && !confirm(`Cabut akun ${a.nama}? Dia akan langsung kehilangan akses ke aplikasi Teman Rara.`)) {
      return;
    }
    setBusy(a.idPenghuni);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/akun-penghuni', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idPenghuni: a.idPenghuni, aksi })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses.');
      setInfo(aksi === 'cabut' ? `Akun ${a.nama} dicabut.` : `Akun ${a.nama} dipulihkan.`);
      setTerbuka(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal memproses.');
    } finally {
      setBusy(null);
    }
  }

  const tampil = hanyaMasalah ? data?.filter((a) => a.ganda || a.yatim) : data;

  return (
    <div>
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

      {ringkasan && (
        <div className="card form-col" style={{ marginBottom: 12 }}>
          <div className="receipt">
            <div className="receipt-row">
              <span className="receipt-label">Akun aktif</span>
              <span className="receipt-value">{ringkasan.akunAktif}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Kamar terisi</span>
              <span className="receipt-value">{ringkasan.kamarTerisi}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Belum punya akun</span>
              <span className="receipt-value">{Math.max(ringkasan.kamarTerisi - ringkasan.akunAktif, 0)}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Akun dicabut</span>
              <span className="receipt-value">{ringkasan.akunDicabut}</span>
            </div>
          </div>
        </div>
      )}

      {ringkasan && (ringkasan.ganda > 0 || ringkasan.yatim > 0) && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>
            {ringkasan.ganda > 0 && `${ringkasan.ganda} akun berbagi kamar yang sama. `}
            {ringkasan.yatim > 0 && `${ringkasan.yatim} akun masih aktif padahal pemiliknya sudah tidak tinggal di sini.`}
          </span>
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className={hanyaMasalah ? 'btn secondary' : 'btn'} onClick={() => setHanyaMasalah(false)}>
          Semua Akun
        </button>
        <button type="button" className={hanyaMasalah ? 'btn' : 'btn secondary'} onClick={() => setHanyaMasalah(true)}>
          Perlu Dibereskan
        </button>
      </div>

      {data === null && (
        <div className="card" aria-busy="true" aria-label="Memuat daftar akun">
          <div className="skeleton" style={{ height: 20, width: '40%' }} />
          <div className="skeleton" style={{ height: 56, marginTop: 14 }} />
        </div>
      )}

      {tampil?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {hanyaMasalah ? 'Tidak ada akun bermasalah. Rapi.' : 'Belum ada penghuni yang mengklaim akun Teman Rara.'}
          </p>
        </div>
      )}

      <div className="bento-grid">
        {tampil?.map((a) => {
          const bermasalah = a.ganda || a.yatim;
          const open = terbuka === a.idPenghuni;
          return (
            <div key={a.idPenghuni} className="bento-card" data-alert={bermasalah}>
              <button
                type="button"
                className="bento-head"
                aria-haspopup="dialog"
                onClick={() => setTerbuka(a.idPenghuni)}
              >
                <span className="icon-tile" aria-hidden>
                  <UserRound size={18} />
                </span>
                <span className="bento-meta">
                  <span className="bento-title">{a.nama}</span>
                  <span className="bento-sub">
                    {a.noKamar ? `K-${a.noKamar}` : 'tanpa kamar'} · {a.aktif ? 'Aktif' : 'Dicabut'}
                    {a.ganda && ' · akun ganda'}
                    {a.yatim && ' · sudah tidak tinggal'}
                  </span>
                </span>
                <ChevronRight size={20} className="accordion-chevron" aria-hidden />
              </button>

              <Modal open={open} title={a.nama} onClose={() => setTerbuka(null)}>
                <div className="form-col">
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span className={bermasalah ? 'prio-badge hot' : 'prio-badge'}>
                      {a.aktif ? 'Aktif' : 'Dicabut'}
                    </span>
                    {a.noKamar && <span className="prio-badge">K-{a.noKamar}</span>}
                  </div>

                  <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.8125rem' }}>
                    Klaim {a.diklaim}
                    {a.dicabut && ` · dicabut ${a.dicabut}`}
                  </p>

                  {a.ganda && (
                    <p style={{ fontSize: '0.875rem', marginTop: 10 }}>
                      Kamar {a.noKamar} punya lebih dari satu akun aktif — cabut yang bukan penghuni sekarang.
                    </p>
                  )}
                  {a.yatim && (
                    <p style={{ fontSize: '0.875rem', marginTop: 10 }}>
                      Sudah tidak tercatat sebagai penghuni aktif (kemungkinan sudah check-out), tapi akunnya masih hidup.
                    </p>
                  )}

                  <div className="btn-row" style={{ marginTop: 12 }}>
                    {a.aktif ? (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy === a.idPenghuni}
                        onClick={() => proses(a, 'cabut')}
                      >
                        {busy === a.idPenghuni ? <LoaderCircle size={18} className="spin" /> : <UserRoundX size={18} />}
                        Cabut Akun
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy === a.idPenghuni || !a.masihTinggal}
                        title={a.masihTinggal ? undefined : 'Hanya penghuni aktif yang akunnya bisa dipulihkan'}
                        onClick={() => proses(a, 'pulihkan')}
                      >
                        {busy === a.idPenghuni ? <LoaderCircle size={18} className="spin" /> : <UserRoundCheck size={18} />}
                        Pulihkan
                      </button>
                    )}
                  </div>
                </div>
              </Modal>
            </div>
          );
        })}
      </div>
    </div>
  );
}
