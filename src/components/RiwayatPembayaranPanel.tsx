'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Receipt } from 'lucide-react';

interface TenantItem {
  id: string;
  nama: string;
  noKamar: string;
  status: string;
}

interface InvoiceRow {
  jenis: string;
  noInv: string;
  tanggalBayar: string;
  periodeAwal: string;
  periodeAkhir: string;
  noKamar: string;
  tipeKamar: string;
  jumlahBulan: number | null;
  total: string;
  status: string;
}

export default function RiwayatPembayaranPanel() {
  const [tenants, setTenants] = useState<TenantItem[] | null>(null);
  const [selected, setSelected] = useState('');
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [totalLunas, setTotalLunas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/ops/admin/riwayat-pembayaran')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setTenants(j.data); })
      .catch(() => setError('Gagal memuat daftar penghuni.'));
  }, []);

  async function pilih(id: string) {
    setSelected(id);
    if (!id) { setRows(null); setTotalLunas(''); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/admin/riwayat-pembayaran?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setRows(json.rows);
      setTotalLunas(json.totalLunas);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }

  const tenant = tenants?.find((t) => t.id === selected);

  const fmtTgl = (s: string) => {
    if (!s) return '—';
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const periode = (r: InvoiceRow) => {
    if (r.jenis === 'DP') return fmtTgl(r.tanggalBayar);
    if (r.periodeAwal && r.periodeAkhir) return `${fmtTgl(r.periodeAwal)} – ${fmtTgl(r.periodeAkhir)}`;
    return fmtTgl(r.periodeAwal);
  };

  return (
    <div>
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Dropdown pilih penghuni */}
      <div className="card" style={{ marginBottom: 16 }}>
        {tenants === null ? (
          <p className="muted"><LoaderCircle size={16} className="spin" aria-hidden /> Memuat daftar penghuni…</p>
        ) : (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="riwayat-penghuni-select">Pilih Penghuni</label>
            <select
              id="riwayat-penghuni-select"
              value={selected}
              onChange={(e) => pilih(e.target.value)}
            >
              <option value="">— pilih penghuni —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nama} — Kamar {t.noKamar} {t.status !== 'Check-in' ? `(${t.status})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Ringkasan penghuni terpilih */}
      {tenant && (
        <div className="banner info" style={{ marginBottom: 12 }}>
          <Receipt size={16} />
          <span>
            <b>{tenant.nama}</b> · Kamar {tenant.noKamar} · {tenant.status}
            {totalLunas ? ` · Total lunas: ${totalLunas}` : ''}
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="card">
          <p className="muted"><LoaderCircle size={16} className="spin" aria-hidden /> Memuat riwayat pembayaran…</p>
        </div>
      )}

      {/* Tabel riwayat */}
      {!loading && rows !== null && (
        rows.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>Tidak ada riwayat pembayaran untuk penghuni ini.</p>
          </div>
        ) : (
          <div className="table-block" style={{ overflowX: 'auto' }}>
            <h2 className="section-title">RIWAYAT PEMBAYARAN</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>No Invoice</th>
                  <th>Jenis</th>
                  <th>Periode / Tgl Bayar</th>
                  <th>Kamar</th>
                  <th>Durasi</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.noInv}</td>
                    <td>
                      <span className={r.jenis === 'DP' ? 'tag tag-warn' : 'tag tag-ok'}>
                        {r.jenis}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{periode(r)}</td>
                    <td>{r.noKamar}{r.tipeKamar ? ` (${r.tipeKamar})` : ''}</td>
                    <td style={{ textAlign: 'center' }}>{r.jumlahBulan ? `${r.jumlahBulan} bln` : '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.total}</td>
                    <td>
                      <span className={r.status === 'Lunas' ? 'tag tag-ok' : 'tag tag-warn'}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Placeholder saat belum pilih */}
      {!loading && rows === null && selected === '' && tenants !== null && (
        <div className="card success-card">
          <span className="icon-tile lg" aria-hidden><Receipt size={26} /></span>
          <p className="muted" style={{ margin: 0 }}>Pilih penghuni di atas untuk melihat riwayat pembayarannya.</p>
        </div>
      )}
    </div>
  );
}
