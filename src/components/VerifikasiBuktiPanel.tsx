'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, FileCheck2, LoaderCircle, Paperclip } from 'lucide-react';

interface Bukti {
  id: string;
  penghuni: string;
  berkas: string | null;
  tipeBerkas: string;
  ukuranKb: number;
  catatan: string;
  diunggah: string;
  invoice: string | null;
  jenisInvoice: string | null;
  nominalInvoice: number;
  periode: string | null;
  status: 'Menunggu' | 'Terverifikasi' | 'Ditolak';
  diprosesOleh: string | null;
  diprosesPada: string | null;
  alasanTolak: string;
}

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

export default function VerifikasiBuktiPanel() {
  const [data, setData] = useState<Bukti[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [semua, setSemua] = useState(false);
  const [alasan, setAlasan] = useState<Record<string, string>>({});
  const [kas, setKas] = useState<Record<string, string>>({});
  const [opsiKas, setOpsiKas] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetch('/api/ops/master/kaslist')
      .then((r) => r.json())
      .then((j) => setOpsiKas(Array.isArray(j.data) ? j.data : []))
      .catch(() => setOpsiKas([]));
  }, []);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(filterSemua = semua) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/verifikasi-bukti${filterSemua ? '?filter=semua' : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat bukti bayar.');
      setData(json.data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat bukti bayar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  async function proses(b: Bukti, aksi: 'verifikasi' | 'tolak' | 'batal') {
    setBusy(b.id);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/verifikasi-bukti', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, aksi, alasan: alasan[b.id] ?? '', akunKasBank: kas[b.id] ?? '' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses.');
      setInfo(
        aksi === 'verifikasi'
          ? json.peringatan || `Bukti dari ${b.penghuni} ditandai sah dan pembayarannya tercatat otomatis.`
          : aksi === 'tolak'
            ? `Bukti dari ${b.penghuni} ditolak.`
            : `Keputusan atas bukti ${b.penghuni} dibatalkan — kembali ke antrean.`
      );
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal memproses.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Verifikasi Bukti Bayar" style={{ marginTop: 28 }}>
      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FileCheck2 size={16} /> Verifikasi Bukti Bayar
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
          Belum Diproses
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
        <div className="card" aria-busy="true" aria-label="Memuat bukti bayar">
          <div className="skeleton" style={{ height: 20, width: '45%' }} />
          <div className="skeleton" style={{ height: 64, marginTop: 14 }} />
        </div>
      )}

      {!loading && data?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {semua ? 'Belum ada bukti bayar yang diunggah penghuni.' : 'Tidak ada bukti bayar yang menunggu diperiksa.'}
          </p>
        </div>
      )}

      <div className="panel-grid">
        {!loading &&
          data?.map((b) => (
          <div key={b.id} className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span className={b.status === 'Menunggu' ? 'prio-badge hot' : 'prio-badge'}>{b.status}</span>
              <span className="muted" style={{ fontSize: '0.8125rem' }}>
                Diunggah {b.diunggah}
              </span>
            </div>

            <h3 style={{ fontSize: '1rem', margin: '8px 0 8px' }}>{b.penghuni}</h3>

            <div className="receipt">
              {b.invoice ? (
                <>
                  <div className="receipt-row">
                    <span className="receipt-label">Invoice</span>
                    <span className="receipt-value">
                      {b.invoice} ({b.jenisInvoice})
                    </span>
                  </div>
                  <div className="receipt-row">
                    <span className="receipt-label">Nominal tagihan</span>
                    <span className="receipt-value">{rupiah(b.nominalInvoice)}</span>
                  </div>
                  {b.periode && (
                    <div className="receipt-row">
                      <span className="receipt-label">Periode</span>
                      <span className="receipt-value">{b.periode}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="receipt-row">
                  <span className="receipt-label">Invoice</span>
                  <span className="receipt-value">Tidak ditautkan penghuni</span>
                </div>
              )}
              <div className="receipt-row">
                <span className="receipt-label">Berkas</span>
                <span className="receipt-value">
                  {b.tipeBerkas.split('/')[1]?.toUpperCase() ?? '—'} · {b.ukuranKb} KB
                </span>
              </div>
            </div>

            {b.catatan && (
              <p style={{ fontSize: '0.875rem', marginTop: 10 }}>
                <span className="muted">Catatan penghuni:</span> {b.catatan}
              </p>
            )}

            {b.berkas && (
              <a href={b.berkas} target="_blank" rel="noreferrer" className="btn-plain" style={{ marginTop: 10 }}>
                <Paperclip size={16} />
                Buka bukti
              </a>
            )}

            {b.status !== 'Menunggu' && (
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>
                {b.status} oleh {b.diprosesOleh} · {b.diprosesPada}
                {b.alasanTolak && ` — ${b.alasanTolak}`}
              </p>
            )}

            {b.status === 'Menunggu' ? (
              <>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor={`kas-${b.id}`}>Rekening / Kas Tujuan</label>
                  <select
                    id={`kas-${b.id}`}
                    value={kas[b.id] ?? ''}
                    onChange={(e) => setKas((p) => ({ ...p, [b.id]: e.target.value }))}
                  >
                    <option value="">— pilih supaya jurnal ikut dibuat —</option>
                    {opsiKas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="help">Pilih Rekening Tujuan Pembayaran.</p>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor={`alasan-${b.id}`}>Alasan penolakan</label>
                  <input
                    id={`alasan-${b.id}`}
                    maxLength={500}
                    value={alasan[b.id] ?? ''}
                    placeholder="Wajib diisi kalau bukti ditolak"
                    onChange={(e) => setAlasan((p) => ({ ...p, [b.id]: e.target.value }))}
                  />
                </div>
                <div className="btn-row">
                  <button type="button" className="btn" disabled={busy === b.id} onClick={() => proses(b, 'verifikasi')}>
                    {busy === b.id && <LoaderCircle size={18} className="spin" />}
                    Bukti Sah
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy === b.id || (alasan[b.id] ?? '').trim().length < 5}
                    onClick={() => proses(b, 'tolak')}
                  >
                    Tolak
                  </button>
                </div>
              </>
            ) : (
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn secondary" disabled={busy === b.id} onClick={() => proses(b, 'batal')}>
                  {busy === b.id && <LoaderCircle size={18} className="spin" />}
                  Batalkan keputusan
                </button>
              </div>
            )}
          </div>
          ))}
      </div>
    </section>
  );
}
