'use client';

import { Fragment, useEffect, useState } from 'react';
import { CircleAlert, ExternalLink, FileText, ImageIcon, Link2, LoaderCircle, Receipt, Trash2, Upload } from 'lucide-react';
import Modal from '@/components/Modal';
import { fmtTanggal } from '@/lib/format-tanggal';
import { GlassDateField } from '@/components/ui/GlassCalendar';

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
  voidAlasan: string;
  koreksiDari: string;
  email: string;
  jumlahDenda: number;
  dendaPerUnit: number;
  diskon: number;
  pajak: number;
  bukti: { label: string; url: string; tipe: string; idDokumen?: string }[];
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

const urlInvoice = (r: InvoiceRow, format?: 'pdf') =>
  `/api/ops/admin/riwayat-pembayaran/invoice?noInv=${encodeURIComponent(r.noInv)}&jenis=${r.jenis}${format ? `&format=${format}` : ''}`;

/** Preview invoice persis seperti yang dikirim ke penghuni (HTML di modal, PDF di tab baru). */
function PreviewInvoice({ r, onClose }: { r: InvoiceRow | null; onClose: () => void }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!r) return;
    let batal = false;
    setHtml('');
    setError('');
    fetch(urlInvoice(r))
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal memuat invoice.');
        return res.text();
      })
      .then((t) => !batal && setHtml(t))
      .catch((e: Error) => !batal && setError(e.message));
    return () => {
      batal = true;
    };
  }, [r]);

  return (
    <Modal open={!!r} title={r ? `Invoice ${r.noInv}` : ''} onClose={onClose} lebar={900}>
      {error && (
        <div className="banner error" role="alert">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {!error && !html && (
        <p className="muted" aria-busy="true">
          <LoaderCircle size={16} className="spin" /> Memuat invoice...
        </p>
      )}
      {html && (
        <iframe
          title={`Preview invoice ${r?.noInv}`}
          srcDoc={html}
          sandbox=""
          style={{ width: '100%', height: '68vh', border: '1px solid var(--line, #ddd)', borderRadius: 8, background: '#fff' }}
        />
      )}
      {r && (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <a className="btn secondary" href={urlInvoice(r, 'pdf')} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> Buka PDF (sama persis dengan email)
          </a>
        </div>
      )}
    </Modal>
  );
}

/** Preview bukti transfer; gambar tampil di modal, PDF dibuka di tab baru. Owner/admin bisa menambah atau melepas bukti. */
function PreviewBukti({
  r,
  bolehEdit,
  onSaved,
  onClose
}: {
  r: InvoiceRow;
  bolehEdit: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [gagal, setGagal] = useState<Record<string, boolean>>({});
  const [link, setLink] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');
  const [error, setError] = useState('');

  async function tautkan(url: string) {
    const res = await fetch('/api/ops/admin/riwayat-pembayaran/bukti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noInv: r.noInv, jenis: r.jenis, url })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Gagal menautkan bukti.');
    await onSaved();
  }

  async function jalankan(kerja: () => Promise<void>, sukses: string) {
    setSibuk(true);
    setError('');
    setPesan('');
    try {
      await kerja();
      setPesan(sukses);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setSibuk(false);
    }
  }

  const unggah = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran file melebihi 2 MB.');
      return;
    }
    void jalankan(async () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', r.jenis === 'DP' ? 'pembayaran-dp' : 'pembayaran-sewa');
      const res = await fetch('/api/ops/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Unggah gagal.');
      await tautkan(String(json.url));
    }, 'Bukti berhasil diunggah dan ditautkan.');
  };

  const lepas = (idDokumen: string) => {
    if (!window.confirm('Lepas bukti ini dari invoice? Berkas di Drive tidak dihapus.')) return;
    void jalankan(async () => {
      const res = await fetch('/api/ops/admin/riwayat-pembayaran/bukti', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idDokumen })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Gagal melepas bukti.');
      await onSaved();
    }, 'Bukti dilepas dari invoice.');
  };

  return (
    <Modal open title={`Bukti transfer ${r.noInv}`} onClose={onClose}>
      {r.bukti.length === 0 && <p className="muted">Belum ada bukti transfer untuk invoice ini.</p>}
      {r.bukti.map((b) => (
        <div key={b.url} style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{b.label}</p>
          {!gagal[b.url] && b.tipe !== 'application/pdf' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.url}
              alt={`Bukti transfer ${r.noInv}`}
              style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, border: '1px solid var(--line, #ddd)' }}
              onError={() => setGagal((g) => ({ ...g, [b.url]: true }))}
            />
          )}
          {(gagal[b.url] || b.tipe === 'application/pdf') && (
            <p className="muted" style={{ margin: '0 0 6px' }}>
              Berkas ini tidak bisa ditampilkan di sini (PDF atau gagal dimuat) — gunakan tombol di bawah.
            </p>
          )}
          <div className="aksi-tabel">
            <a className="btn secondary tabel" href={b.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Buka di tab baru
            </a>
            {bolehEdit && b.idDokumen && (
              <button type="button" className="btn secondary tabel" disabled={sibuk} onClick={() => lepas(b.idDokumen!)}>
                <Trash2 size={14} /> Lepas
              </button>
            )}
          </div>
        </div>
      ))}

      {bolehEdit && (
        <div style={{ borderTop: '1px solid var(--line, #ddd)', paddingTop: 14, marginTop: 8 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Tambah bukti transfer</p>
          <div className="field">
            {/* Input file bawaan disembunyikan tema Ops, jadi label dipakai sebagai tombol. */}
            <input
              id="bukti-file"
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              disabled={sibuk}
              onChange={(e) => {
                unggah(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <label htmlFor="bukti-file" className="btn secondary tabel" style={{ cursor: sibuk ? 'wait' : 'pointer' }}>
              {sibuk ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />} Pilih &amp; unggah file (foto/PDF, maks 2 MB)
            </label>
          </div>
          <div className="field">
            <label htmlFor="bukti-link">…atau tempel link berkas Google Drive</label>
            <input
              id="bukti-link"
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/file/d/..."
              value={link}
              disabled={sibuk}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn tabel"
              disabled={sibuk || !link.trim()}
              onClick={() =>
                void jalankan(async () => {
                  await tautkan(link.trim());
                  setLink('');
                }, 'Link bukti ditautkan.')
              }
            >
              {sibuk ? <LoaderCircle size={14} className="spin" /> : <Link2 size={14} />} Tautkan link
            </button>
          </div>
          {error && (
            <div className="banner error" role="alert" style={{ marginTop: 10 }}>
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          )}
          {pesan && (
            <p className="muted" style={{ marginTop: 10 }}>
              {pesan}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
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
  const [previewInv, setPreviewInv] = useState<InvoiceRow | null>(null);
  const [noBukti, setNoBukti] = useState<string | null>(null);
  const previewBukti = rows?.find((x) => x.noInv === noBukti) ?? null;
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

  async function pilih(id: string, diam = false) {
    setSelected(id);
    if (!diam) setEditNo(null);
    if (!id) { setRows(null); setTotalLunas(''); return; }
    if (!diam) setLoading(true);
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
      if (!diam) setLoading(false);
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
    if (!window.confirm(`Koreksi ${r.noInv}? Invoice lama di-void (jurnalnya dibalik), invoice baru bernomor -K dibuat dan dikirim ke ${form.email}.`)) return;
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
      setInfo([json.noInvBaru ? `Invoice koreksi ${json.noInvBaru} dibuat.` : '', json.pesan].filter(Boolean).join(' '));
      setEditNo(null);
      await pilih(selected);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  }

  async function voidPembayaran(r: InvoiceRow) {
    const alasan = window.prompt(`Void ${r.noInv}? Jurnalnya dibalik, tidak ada invoice pengganti, dan salinan invoice bercap DIBATALKAN dikirim ke email penghuni.\n\nAlasan (minimal 5 karakter):`);
    if (alasan === null) return;
    setMenyimpan(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/riwayat-pembayaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noInv: r.noInv, jenis: r.jenis, alasan })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mem-void.');
      setInfo(json.pesan);
      await pilih(selected);
    } catch (e: any) {
      setError(e.message || 'Gagal mem-void.');
    } finally {
      setMenyimpan(false);
    }
  }

  const ubah = (k: keyof FormEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const tenant = tenants?.find((t) => t.id === selected);

  const fmtTgl = (s: string) => fmtTanggal(s, '—');

  const periode = (r: InvoiceRow) => {
    if (r.jenis === 'DP') return fmtTgl(r.tanggalBayar);
    if (r.periodeAwal && r.periodeAkhir) return `${fmtTgl(r.periodeAwal)} – ${fmtTgl(r.periodeAkhir)}`;
    return fmtTgl(r.periodeAwal);
  };

  return (
    <div>
      {/* Dipasang hanya saat dibuka: Modal memakai portal, dan itu tidak boleh ikut render di server. */}
      {previewInv && <PreviewInvoice r={previewInv} onClose={() => setPreviewInv(null)} />}
      {previewBukti && (
        <PreviewBukti r={previewBukti} bolehEdit={bolehEdit} onSaved={() => pilih(selected, true)} onClose={() => setNoBukti(null)} />
      )}
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
                  <th>Dokumen</th>
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
                      <span className={r.status === 'Lunas' ? 'tag tag-ok' : 'tag tag-warn'} title={r.voidAlasan || (r.koreksiDari ? `Koreksi dari ${r.koreksiDari}` : '')}>
                        {r.status}
                      </span>
                      {r.koreksiDari && r.status !== 'Void' && <div className="muted" style={{ fontSize: 11 }}>koreksi dari {r.koreksiDari}</div>}
                    </td>
                    <td>
                      <div className="aksi-tabel">
                      <button type="button" className="btn secondary tabel" onClick={() => setPreviewInv(r)} title="Lihat invoice">
                        <FileText size={14} /> Invoice
                      </button>
                      <button
                        type="button"
                        className="btn secondary tabel"
                        onClick={() => setNoBukti(r.noInv)}
                        disabled={r.bukti.length === 0 && !bolehEdit}
                        title={r.bukti.length ? 'Lihat bukti transfer' : bolehEdit ? 'Tambah bukti transfer' : 'Belum ada bukti transfer'}
                      >
                        <ImageIcon size={14} /> {r.bukti.length ? `Bukti (${r.bukti.length})` : bolehEdit ? '+ Bukti' : 'Bukti'}
                      </button>
                      </div>
                    </td>
                    {bolehEdit && (
                      <td>
                        {r.status === 'Void' ? (
                          <span className="muted" style={{ fontSize: 12 }}>{r.voidAlasan}</span>
                        ) : (
                          <div className="aksi-tabel">
                            <button type="button" className="btn secondary tabel" onClick={() => mulaiEdit(r)}>
                              Koreksi
                            </button>
                            <button type="button" className="btn secondary tabel" disabled={menyimpan} onClick={() => voidPembayaran(r)}>
                              Void
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {editNo === r.noInv && form && (
                    <tr>
                      <td colSpan={9}>
                        <div className="card" style={{ margin: '4px 0' }}>
                          <h3 style={{ fontSize: '1rem', margin: '0 0 10px' }}>Koreksi {r.noInv}</h3>
                          <div className="panel-grid">
                            <div className="field">
                              <label htmlFor="e-email">Email penghuni</label>
                              <input id="e-email" type="email" value={form.email} onChange={ubah('email')} />
                            </div>
                            <div className="field">
                              <label htmlFor="e-tgl">Tanggal bayar</label>
                              <GlassDateField id="e-tgl" value={form.tanggalBayar} onChange={(v) => setForm((f) => (f ? { ...f, tanggalBayar: v } : f))} buttonClassName="ou-datefield" />
                            </div>
                            {r.jenis === 'Sewa' && (
                              <>
                                <div className="field">
                                  <label htmlFor="e-awal">Periode awal</label>
                                  <GlassDateField id="e-awal" value={form.periodeAwal} onChange={(v) => setForm((f) => (f ? { ...f, periodeAwal: v } : f))} buttonClassName="ou-datefield" />
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
                            Total dihitung ulang. Invoice lama di-void dan jurnalnya dibalik (tetap tercatat sebagai riwayat), lalu invoice
                            baru bernomor -K1, -K2, dst. dibuat dan dikirim ke email di atas.
                          </p>
                          <div className="btn-row">
                            <button type="button" className="btn" disabled={menyimpan} onClick={() => simpanEdit(r)}>
                              {menyimpan && <LoaderCircle size={18} className="spin" />}
                              Koreksi & kirim invoice baru
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
