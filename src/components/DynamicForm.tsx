'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  CircleAlert,
  House,
  LoaderCircle,
  Paperclip,
  ReceiptText,
  TriangleAlert,
  WandSparkles
} from 'lucide-react';
import type { FieldDef, FieldOption, PreviewResult } from '@/lib/modules/types';

interface Props {
  moduleId: string;
  fields: FieldDef[];
  hasPreview?: boolean;
  autoFillTrigger?: string[];
  /** Mode edit (fitur Edit Data): form terisi nilai entri lama, submit menimpa entri via /api/edit. */
  editRef?: string;
  initialValues?: Record<string, string>;
  onEditDone?: () => void;
}

type ChangeEl = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function DynamicForm({ moduleId, fields, hasPreview, autoFillTrigger, editRef, initialValues, onEditDone }: Props) {
  const isEdit = !!editRef;
  const [values, setValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, FieldOption[]>>({});
  const [masterRaw, setMasterRaw] = useState<Record<string, Record<string, unknown>[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState('');
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [autoFillNote, setAutoFillNote] = useState('');
  const draftKey = `draft:${moduleId}`;

  function visibleValuesNow(): Record<string, string> {
    const visibleFields = fields.filter((f) => isVisible(f, values));
    const out: Record<string, string> = {};
    // Passthrough: key prefill URL yang bukan field form (mis. woId dari link joblist Admin)
    // tetap ikut terkirim supaya handler bisa memakainya.
    for (const k of Object.keys(initialValues ?? {})) {
      if (!fields.some((f) => f.name === k) && values[k]) out[k] = values[k];
    }
    for (const f of visibleFields) out[f.name] = values[f.name] ?? '';
    return out;
  }

  // Muat draft tersimpan (koneksi lapangan buruk → data tidak hilang, PRD §10) + default tanggal hari ini.
  // Mode edit: nilai awal dari entri yang dipilih — TANPA draft localStorage (jangan menimpa draft form input).
  useEffect(() => {
    if (isEdit) {
      setValues({ ...(initialValues ?? {}) });
      return;
    }
    const draft = localStorage.getItem(draftKey);
    const initial: Record<string, string> = draft ? JSON.parse(draft) : {};
    // Prefill dari URL (mis. link "Catat Pengeluaran" joblist Admin) menimpa draft.
    Object.assign(initial, initialValues ?? {});
    for (const f of fields) {
      if (f.type === 'date' && f.defaultToday && !initial[f.name]) {
        initial[f.name] = new Date().toISOString().slice(0, 10);
      }
    }
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, editRef]);

  // Ambil opsi dropdown dari master data untuk field select-async.
  useEffect(() => {
    fields
      .filter((f): f is FieldDef & { master: string } => f.type === 'select-async' && !!f.master)
      .forEach((f) => {
        fetch(`/api/master/${encodeURIComponent(f.master)}`)
          .then((r) => r.json())
          .then((res) => {
            if (!res.ok) return;
            const raw = res.data as Record<string, unknown>[];
            setMasterRaw((prev) => ({ ...prev, [f.master]: raw }));
            if (!f.dependsOn) {
              const vKey = f.masterValue || 'id';
              const lKey = f.masterLabel || vKey;
              const opts: FieldOption[] = raw.map((item) => ({ value: String(item[vKey]), label: String(item[lKey]) }));
              setOptions((prev) => ({ ...prev, [f.name]: opts }));
            }
          })
          .catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  // Auto-fill: kalau modul ini punya autoFillTrigger dan semua field pemicu sudah terisi, hitung
  // field lain otomatis (mis. Tgl Masuk/Tunggakan di Checkout begitu Penghuni & Tanggal dipilih).
  const autoFillKey = (autoFillTrigger || []).map((name) => values[name] ?? '').join('');
  useEffect(() => {
    if (!autoFillTrigger || autoFillTrigger.length === 0) return;
    if (autoFillTrigger.some((name) => !String(values[name] ?? '').trim())) {
      setAutoFillNote('');
      return;
    }
    let cancelled = false;
    fetch(`/api/autofill/${moduleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: visibleValuesNow() })
    })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.ok) return;
        setValues((prev) => {
          const next = { ...prev, ...res.fields };
          if (!isEdit) localStorage.setItem(draftKey, JSON.stringify(next));
          return next;
        });
        setAutoFillNote(res.note || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFillKey]);

  function update(name: string, val: string) {
    const next = { ...values, [name]: val };
    // Reset field yang bergantung ke field ini, biar tidak menyisakan pilihan yg jadi tidak valid.
    for (const f of fields) {
      if (f.dependsOn === name) next[f.name] = '';
    }
    // Reset field yang showIf-nya bergantung ke field ini dan jadi tidak terlihat lagi, biar tidak
    // menyisakan nilai lama dari field yang sudah disembunyikan (mis. ganti Jenis Pembayaran Sewa→DP).
    for (const f of fields) {
      if (f.showIf?.field === name && !isVisible(f, next)) next[f.name] = '';
    }
    setValues(next);
    if (!isEdit) localStorage.setItem(draftKey, JSON.stringify(next));
  }

  // Hitung opsi field select-async yang bergantung pada field lain (mis. Nama Akun bergantung Tipe Akun).
  function optionsFor(f: FieldDef): FieldOption[] | undefined {
    if (f.type !== 'select-async') return undefined;
    if (!f.dependsOn) return options[f.name];
    const depVal = values[f.dependsOn];
    if (!depVal || !f.master) return [];
    const raw = masterRaw[f.master] || [];
    const filtered = f.filterBy ? raw.filter((item) => String(item[f.filterBy!]) === depVal) : raw;
    const vKey = f.masterValue || 'id';
    const lKey = f.masterLabel || vKey;
    return filtered.map((item) => ({ value: String(item[vKey]), label: String(item[lKey]) }));
  }

  async function doSubmit() {
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    // Mode edit: timpa entri lama via /api/edit (bukan tambah baris baru via /api/submit).
    const url = isEdit ? `/api/edit/${moduleId}` : `/api/submit/${moduleId}`;
    const body = isEdit
      ? { requestId, ref: editRef, values: visibleValuesNow() }
      : { requestId, values: visibleValuesNow() };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan data.');
    if (!isEdit) {
      localStorage.removeItem(draftKey);
      setValues({});
    }
    setPreviewData(null);
    setWarning(json.warning || '');
    setSuccess(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const visibleFields = fields.filter((f) => isVisible(f, values));
    for (const f of visibleFields) {
      if (f.required && !String(values[f.name] ?? '').trim()) {
        setError(`${f.label} wajib diisi.`);
        return;
      }
    }
    setLoading(true);
    try {
      if (hasPreview) {
        // Modul ini minta konfirmasi dulu — hitung preview (tanpa efek samping), submit sungguhan
        // baru terjadi setelah user klik "Konfirmasi & Kirim" di layar preview.
        const res = await fetch(`/api/preview/${moduleId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: visibleValuesNow() })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal menghitung preview.');
        setPreviewData({ fields: json.fields, raw: json.raw });
      } else {
        await doSubmit();
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memproses.');
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmSend() {
    setError('');
    setLoading(true);
    try {
      await doSubmit();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <motion.div
        className="card success-card"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        <SuccessCheck />
        <h2>{isEdit ? 'Perubahan tersimpan' : 'Data berhasil disimpan'}</h2>
        {warning ? (
          <div className="banner warn">
            <TriangleAlert size={16} />
            <span>{warning}</span>
          </div>
        ) : (
          <p className="muted">{isEdit ? 'Entri lama sudah ditimpa dengan nilai baru.' : 'Sudah masuk ke spreadsheet — silakan lanjut input berikutnya.'}</p>
        )}
        {isEdit ? (
          <button type="button" className="btn" onClick={() => onEditDone?.()}>
            Selesai
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => setSuccess(false)}>
              Input Lagi
            </button>
            <Link className="btn-plain" href="/">
              <House size={16} />
              Kembali ke Beranda
            </Link>
          </>
        )}
      </motion.div>
    );
  }

  if (previewData) {
    return (
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ReceiptText size={18} />
          Preview Invoice
        </h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Cek dulu — data dikirim setelah kamu konfirmasi.
        </p>
        <dl className="receipt">
          {previewData.fields.map((f) => (
            <div className="receipt-row" key={f.label}>
              <dt className="receipt-label">{f.label}</dt>
              <dd className="receipt-value">{f.value}</dd>
            </div>
          ))}
        </dl>
        {error && (
          <div className="banner error" role="alert">
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="btn-row">
          <button type="button" className="btn secondary" onClick={() => setPreviewData(null)} disabled={loading}>
            <ChevronLeft size={18} />
            Kembali
          </button>
          <button type="button" className="btn" onClick={onConfirmSend} disabled={loading}>
            {loading && <LoaderCircle size={18} className="spin" />}
            {loading ? 'Mengirim...' : 'Konfirmasi & Kirim'}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      {fields.map((f) => {
        const visible = isVisible(f, values);
        const body = (
          <>
            <label htmlFor={f.name}>
              {f.label}
              {f.required && (
                <span className="req" aria-hidden>
                  {' '}
                  *
                </span>
              )}
            </label>
            {renderField(f, values[f.name] ?? '', (v) => update(f.name, v), optionsFor(f))}
            {f.helpText && <p className="help">{f.helpText}</p>}
          </>
        );

        // Field kondisional (showIf) masuk/keluar dengan animasi tinggi + fade.
        if (f.showIf) {
          return (
            <AnimatePresence key={f.name} initial={false}>
              {visible && (
                <motion.div
                  className="field"
                  style={{ overflow: 'hidden' }}
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  {body}
                </motion.div>
              )}
            </AnimatePresence>
          );
        }

        return visible ? (
          <div className="field" key={f.name}>
            {body}
          </div>
        ) : null;
      })}

      {autoFillNote && (
        <div className="banner info">
          <WandSparkles size={16} />
          <span>{autoFillNote}</span>
        </div>
      )}
      {error && (
        <div className="banner error" role="alert">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="btn" disabled={loading} style={{ marginTop: 20 }}>
        {loading && <LoaderCircle size={18} className="spin" />}
        {loading ? (hasPreview ? 'Menghitung...' : 'Menyimpan...') : hasPreview ? 'Lihat Preview' : isEdit ? 'Simpan Perubahan' : 'Simpan'}
      </button>
    </form>
  );
}

/** Lingkaran + centang yang digambar (stroke draw) saat data tersimpan. */
function SuccessCheck() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden>
      <circle cx="38" cy="38" r="34" fill="var(--brand-tint)" />
      <motion.circle
        cx="38"
        cy="38"
        r="34"
        stroke="var(--brand)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      />
      <motion.path
        d="M24 39.5 L34 49 L52 28"
        stroke="var(--brand)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.2, ease: EASE }}
      />
    </svg>
  );
}

function isVisible(f: FieldDef, values: Record<string, string>): boolean {
  if (!f.showIf) return true;
  const val = values[f.showIf.field] ?? '';
  const target = f.showIf.equals;
  return Array.isArray(target) ? target.includes(val) : val === target;
}

/**
 * Field upload: file dipilih → langsung diunggah ke /api/upload (Drive via
 * service account) → value field = URL Drive (disimpan ke database saat submit).
 */
function FileField({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const maxMb = f.maxSizeMb ?? 2;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError('');
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`Ukuran file melebihi ${maxMb} MB.`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', f.uploadKind || '');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload gagal.');
      setFileName(file.name);
      onChange(json.url || '');
    } catch (e: any) {
      setUploadError(e.message || 'Upload gagal.');
      onChange('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <label className={value ? 'file-btn filled' : 'file-btn'} htmlFor={f.name}>
        {uploading ? <LoaderCircle size={18} className="spin" /> : <Paperclip size={18} />}
        <span>
          {uploading
            ? 'Mengunggah...'
            : value
              ? `${fileName || 'File terunggah'} ✓`
              : f.placeholder || `Pilih file (maks ${maxMb} MB)`}
        </span>
        <input
          id={f.name}
          name={f.name}
          type="file"
          accept={f.accept}
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
      {uploadError && <p className="error" style={{ marginTop: 6 }}>{uploadError}</p>}
    </>
  );
}

function renderField(f: FieldDef, value: string, onChange: (v: string) => void, asyncOptions?: FieldOption[]) {
  const onInputChange = (e: ChangeEl) => onChange(e.target.value);

  switch (f.type) {
    case 'textarea':
      return <textarea id={f.name} name={f.name} value={value} onChange={onInputChange} placeholder={f.placeholder} />;
    case 'number':
      return (
        <input
          id={f.name}
          name={f.name}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={onInputChange}
          placeholder={f.placeholder}
        />
      );
    case 'date':
      return <input id={f.name} name={f.name} type="date" value={value} onChange={onInputChange} />;
    case 'time':
      return <input id={f.name} name={f.name} type="time" value={value} onChange={onInputChange} />;
    case 'file':
      return <FileField f={f} value={value} onChange={onChange} />;
    case 'select':
    case 'select-async': {
      const isAsync = f.type === 'select-async';
      const opts = isAsync ? asyncOptions || [] : f.options || [];
      const waitingOnDependency = isAsync && !!f.dependsOn && (asyncOptions || []).length === 0;
      const stillLoading = isAsync && !f.dependsOn && asyncOptions === undefined;
      const noDataAvailable = isAsync && !f.dependsOn && Array.isArray(asyncOptions) && asyncOptions.length === 0;
      const placeholder = stillLoading
        ? 'Memuat...'
        : waitingOnDependency
          ? 'Pilih di atas dulu...'
          : noDataAvailable
            ? 'Tidak ada pilihan tersedia'
            : 'Pilih...';
      return (
        <select
          id={f.name}
          name={f.name}
          value={value}
          onChange={onInputChange}
          disabled={waitingOnDependency || stillLoading || noDataAvailable}
        >
          <option value="">{placeholder}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    default:
      return (
        <input id={f.name} name={f.name} type="text" value={value} onChange={onInputChange} placeholder={f.placeholder} />
      );
  }
}
