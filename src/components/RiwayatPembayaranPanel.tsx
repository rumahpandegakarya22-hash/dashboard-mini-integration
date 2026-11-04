'use client';

import { Fragment, useEffect, useState } from 'react';
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
  email: string;
  jumlahDenda: number;
  dendaPerUnit: number;
  diskon: number;
  pajak: number;
}

interface FormEdit {
  email: string;
  tanggalBayar: string;
  periodeAwal: string;
  jumlahBulan: string;
  jumlahDenda: string;
  dendaPerUnit: string;
  diskon: string;
  pajak: string;
  akunKasBank: string;
}

/** Kartu pengaturan email CC untuk semua invoice yang dikirim. */
function PengaturanCc() {
  const [teks, setTeks] = useState('');
  const [boleh, setBoleh] = useState(false);
  const [pesan, setPesan] = useState('');
  const [simpan, setSimpan] = useState(false);

  useEffect(() => {
    fetch('/api/ops/admin/cc-invoice')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok) {
          setBoleh(true);
          setTeks((j.cc as string[]).join(', '));
        }
      })
      .catch(() => {});
  }, []);

  if (!boleh) return null;

  async function kirim() {
    setSimpan(true);
    setPesan('');
    try {
      const res = await fetch('/api/ops/admin/cc-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cc: teks })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan.');
      setTeks((j.cc as string[]).join(', '));
      setPesan(j.cc.length ? `Tersimpan. Invoice berikutnya di-CC ke ${j.cc.length} alamat.` : 'Tersimpan. Tidak ada CC.');
    } catch (e: any) {
      setPesan(e.message || 'Gagal menyimpan.');
    } finally {
      setSimpan(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="cc-invoice">Email CC invoice</label>
        <input
          id="cc-invoice"
          value={teks}
          placeholder="admin@contoh.com, owner@contoh.com"
          onChange={(e) => setTeks(e.target.value)}
        />
        <p className="help">Pisahkan dengan koma, maksimal 5. Berlaku untuk semua email invoice, termasuk kirim ulang setelah edit.</p>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className="btn" disabled={simpan} onClick={kirim}>
          {simpan && <LoaderCircle size={18} className="spin" />}
          Simpan CC
        </button>
      </div>
      {pesan && <p className="muted" role="status" style={{ marginTop: 8, fontSize: '0.875rem' }}>{pesan}</p>}
    </div>
  );
}

export default function RiwayatPembayaranPanel() {
  const [tenants, setTenants] = useState<TenantItem[] | null>(null);
  const [selected, setSelected] = useState('');
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [totalLunas, setTotalLunas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [bolehEdit, setBolehEdit] = useState(false);
  const [editNo, setEditNo] = useState<string | null>(null);
  const [form, setForm] = useState<FormEdit | null>(null);
  const [opsiKas, setOpsiKas] = useState<{ id: string; label: string }[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    fetch('/api/ops/master/kaslist')
      .then((r) => r.json())
      .then((j) => setOpsiKas(Array.isArray(j.data) ? j.data : []))
      .catch(() => setOpsiKas([]));
  }, []);

  useEffect(() => {
    fetch('/api/ops/admin/riwayat-pembayaran')
      .then((r) => r.json())
      .then((j) => { if (j.ok) setTenants(j.data); })
      .catch(() => setError('Gagal memuat daftar penghuni.'));
  }, []);

  async function pilih(id: string) {
    setSelected(id);
    setEditNo(null);
    if (!id) { setRows(null); setTotalLunas(''); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/admin/riwayat-pembayaran?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setRows(json.rows);
      setTotalLunas(json.totalLunas);
      setBolehEdit(!!json.bolehEdit);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat riwayat.');
    } finally {
      setLoading(false);
    }
  }

  function mulaiEdit(r: InvoiceRow) {
    setInfo('');
    setError('');
    setEditNo(r.noInv);
    setForm({
      email: r.email,
      tanggalBayar: r.tanggalBayar,
      periodeAwal: r.jenis === 'Sewa' ? r.periodeAwal : '',
      jumlahBulan: r.jumlahBulan ? String(r.jumlahBulan) : '',
      jumlahDenda: String(r.jumlahDenda),
      dendaPerUnit: String(r.dendaPerUnit),
      diskon: String(r.diskon),
      pajak: String(r.pajak),
      akunKasBank: ''
    });
  }

  async function simpanEdit(r: InvoiceRow) {
    if (!form) return;
    if (!window.confirm(`Simpan perubahan ${r.noInv}? Pembayaran & jurnal ikut berubah dan invoice REVISI dikirim ulang ke ${form.email}.`)) return;
    setMenyimpan(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/riwayat-pembayaran', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noInv: r.noInv, jenis: r.jenis, ...form })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setInfo([json.pesan, json.peringatan].filter(Boolean).join(' '));
      setEditNo(null);
      await pilih(selected);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  }

  const ubah = (k: keyof FormEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

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

      {info && (
        <div className="banner info" role="status" style={{ marginBottom: 12 }}>
          <span>{info}</span>
        </div>
      )}

      <PengaturanCc />

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
                  {bolehEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <Fragment key={i}>
                  <tr>
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
                    {bolehEdit && (
                      <td>
                        <button type="button" className="btn secondary" onClick={() => mulaiEdit(r)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                  {editNo === r.noInv && form && (
                    <tr>
                      <td colSpan={8}>
                        <div className="card" style={{ margin: '4px 0' }}>
                          <h3 style={{ fontSize: '1rem', margin: '0 0 10px' }}>Edit {r.noInv}</h3>
                          <div className="panel-grid">
                            <div className="field">
                              <label htmlFor="e-email">Email penghuni</label>
                              <input id="e-email" type="email" value={form.email} onChange={ubah('email')} />
                            </div>
                            <div className="field">
                              <label htmlFor="e-tgl">Tanggal bayar</label>
                              <input id="e-tgl" type="date" value={form.tanggalBayar} onChange={ubah('tanggalBayar')} />
                            </div>
                            {r.jenis === 'Sewa' && (
                              <>
                                <div className="field">
                                  <label htmlFor="e-awal">Periode awal</label>
                                  <input id="e-awal" type="date" value={form.periodeAwal} onChange={ubah('periodeAwal')} />
                                </div>
                                <div className="field">
                                  <label htmlFor="e-bln">Lama sewa (bulan)</label>
                                  <input id="e-bln" type="number" min={1} value={form.jumlahBulan} onChange={ubah('jumlahBulan')} />
                                </div>
                                <div className="field">
                                  <label htmlFor="e-jd">Jumlah denda (unit)</label>
                                  <input id="e-jd" type="number" min={0} value={form.jumlahDenda} onChange={ubah('jumlahDenda')} />
                                </div>
                                <div className="field">
                                  <label htmlFor="e-dp">Denda per unit (Rp)</label>
                                  <input id="e-dp" type="number" min={0} value={form.dendaPerUnit} onChange={ubah('dendaPerUnit')} />
                                </div>
                              </>
                            )}
                            <div className="field">
                              <label htmlFor="e-diskon">Diskon (Rp)</label>
                              <input id="e-diskon" type="number" min={0} value={form.diskon} onChange={ubah('diskon')} />
                            </div>
                            <div className="field">
                              <label htmlFor="e-pajak">Pajak (Rp)</label>
                              <input id="e-pajak" type="number" min={0} value={form.pajak} onChange={ubah('pajak')} />
                            </div>
                            <div className="field">
                              <label htmlFor="e-kas">Rekening / Kas</label>
                              <select id="e-kas" value={form.akunKasBank} onChange={ubah('akunKasBank')}>
                                <option value="">— tetap seperti jurnal lama —</option>
                                {opsiKas.map((o) => (
                                  <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <p className="help">
                            Total dihitung ulang. Pembayaran dan jurnal ikut berubah, lalu invoice REVISI dikirim ulang ke email di atas.
                            No. invoice tidak berubah.
                          </p>
                          <div className="btn-row">
                            <button type="button" className="btn" disabled={menyimpan} onClick={() => simpanEdit(r)}>
                              {menyimpan && <LoaderCircle size={18} className="spin" />}
                              Simpan & kirim ulang
                            </button>
                            <button type="button" className="btn secondary" disabled={menyimpan} onClick={() => setEditNo(null)}>
                              Batal
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
