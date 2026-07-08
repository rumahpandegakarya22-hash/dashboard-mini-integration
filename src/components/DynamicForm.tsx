'use client';

import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import type { FieldDef, FieldOption } from '@/lib/modules/types';

interface Props {
  moduleId: string;
  fields: FieldDef[];
}

type ChangeEl = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

export default function DynamicForm({ moduleId, fields }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, FieldOption[]>>({});
  const [masterRaw, setMasterRaw] = useState<Record<string, Record<string, unknown>[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState('');
  const draftKey = `draft:${moduleId}`;

  // Muat draft tersimpan (koneksi lapangan buruk → data tidak hilang, PRD §10) + default tanggal hari ini.
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    const initial: Record<string, string> = draft ? JSON.parse(draft) : {};
    for (const f of fields) {
      if (f.type === 'date' && f.defaultToday && !initial[f.name]) {
        initial[f.name] = new Date().toISOString().slice(0, 10);
      }
    }
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

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

  function update(name: string, val: string) {
    const next = { ...values, [name]: val };
    // Reset field yang bergantung ke field ini, biar tidak menyisakan pilihan yg jadi tidak valid.
    for (const f of fields) {
      if (f.dependsOn === name) next[f.name] = '';
    }
    setValues(next);
    localStorage.setItem(draftKey, JSON.stringify(next));
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    for (const f of fields) {
      if (f.required && !String(values[f.name] ?? '').trim()) {
        setError(`${f.label} wajib diisi.`);
        return;
      }
    }
    setLoading(true);
    try {
      const requestId =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch(`/api/submit/${moduleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, values })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan data.');
      localStorage.removeItem(draftKey);
      setValues({});
      setWarning(json.warning || '');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card">
        <p className="success">Data berhasil disimpan.</p>
        {warning && <div className="warn">{warning}</div>}
        <button type="button" onClick={() => setSuccess(false)}>
          Input Lagi
        </button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      {fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name}>
            {f.label}
            {f.required && ' *'}
          </label>
          {renderField(f, values[f.name] ?? '', (v) => update(f.name, v), optionsFor(f))}
          {f.helpText && <div className="muted">{f.helpText}</div>}
        </div>
      ))}
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  );
}

function renderField(f: FieldDef, value: string, onChange: (v: string) => void, asyncOptions?: FieldOption[]) {
  const onInputChange = (e: ChangeEl) => onChange(e.target.value);

  switch (f.type) {
    case 'textarea':
      return <textarea id={f.name} name={f.name} value={value} onChange={onInputChange} placeholder={f.placeholder} />;
    case 'number':
      return (
        <input id={f.name} name={f.name} type="number" value={value} onChange={onInputChange} placeholder={f.placeholder} />
      );
    case 'date':
      return <input id={f.name} name={f.name} type="date" value={value} onChange={onInputChange} />;
    case 'time':
      return <input id={f.name} name={f.name} type="time" value={value} onChange={onInputChange} />;
    case 'file':
      // Upload aktual ke Drive dibangun Tahap 4 (/api/upload); untuk sekarang hanya menampung nama file.
      return <input id={f.name} name={f.name} type="file" onChange={(e) => onChange(e.target.files?.[0]?.name || '')} />;
    case 'select':
    case 'select-async': {
      const opts = f.type === 'select' ? f.options || [] : asyncOptions || [];
      const waitingOnDependency = f.type === 'select-async' && !!f.dependsOn && opts.length === 0;
      return (
        <select id={f.name} name={f.name} value={value} onChange={onInputChange} disabled={waitingOnDependency}>
          <option value="">{waitingOnDependency ? 'Pilih di atas dulu...' : 'Pilih...'}</option>
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
