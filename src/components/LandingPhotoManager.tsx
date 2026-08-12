'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Trash2, ChevronUp, ChevronDown, Star, Plus } from 'lucide-react';

interface Photo { id: number; url: string; alt: string | null; order: number; is_cover: number; }

async function api(method: string, body: object) {
  const res = await fetch('/api/ops/landing-page/photos', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal.');
  return json;
}

export default function LandingPhotoManager({ scope, roomId }: { scope: 'room' | 'gallery'; roomId?: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<number | 'add' | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');

  const q = scope === 'room' ? `?scope=room&roomId=${roomId}` : '?scope=gallery';

  const load = useCallback(async () => {
    setErr('');
    try {
      const res = await fetch(`/api/ops/landing-page/photos${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat foto.');
      setPhotos(json.photos.map((p: any) => ({ id: Number(p.id ?? p[0]), url: String(p.url ?? p[1]), alt: p.alt ?? p[2], order: Number(p.order ?? p[3]), is_cover: Number(p.is_cover ?? p[4]) })));
    } catch (e: any) { setErr(e.message); }
  }, [q]);

  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<void>, key: number | 'add') {
    setBusy(key); setErr('');
    try { await fn(); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }

  const add = () => run(async () => {
    if (!url.trim()) throw new Error('URL foto wajib diisi.');
    await api('POST', { scope, roomId, url: url.trim(), alt: alt.trim() });
    setUrl(''); setAlt('');
  }, 'add');

  const del = (id: number) => run(() => api('DELETE', { scope, roomId, id }).then(() => {}), id);
  const move = (id: number, action: 'up' | 'down') => run(() => api('PATCH', { scope, roomId, id, action }).then(() => {}), id);
  const cover = (id: number) => run(() => api('PATCH', { scope, roomId, id, action: 'cover' }).then(() => {}), id);

  return (
    <div>
      {err && <div className="banner error" style={{ marginBottom: 10 }}><CircleAlert size={16} /> {err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {photos === null ? (
          <p className="muted">Memuat foto…</p>
        ) : photos.length === 0 ? (
          <p className="muted">Belum ada foto. Tambahkan di bawah.</p>
        ) : photos.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: p.is_cover ? 'var(--brand-tint)' : 'transparent' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt ?? ''} style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flex: 'none' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.alt || p.url}</div>
              {p.is_cover === 1 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>★ COVER</span>}
            </div>
            <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 6px' }} title="Naik" disabled={busy === p.id || i === 0} onClick={() => move(p.id, 'up')}><ChevronUp size={15} /></button>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 6px' }} title="Turun" disabled={busy === p.id || i === photos.length - 1} onClick={() => move(p.id, 'down')}><ChevronDown size={15} /></button>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 6px', color: p.is_cover ? 'var(--brand)' : undefined }} title="Jadikan cover" disabled={busy === p.id || p.is_cover === 1} onClick={() => cover(p.id)}><Star size={15} fill={p.is_cover ? 'currentColor' : 'none'} /></button>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px 6px' }} title="Hapus" disabled={busy === p.id} onClick={() => del(p.id)}>{busy === p.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}</button>
            </div>
          </div>
        ))}
      </div>

      <div className="form-col" style={{ maxWidth: 520 }}>
        <div className="field"><label>URL Foto Baru</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
        <div className="field"><label>Alt / Keterangan</label><input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Deskripsi singkat foto" /></div>
        <button type="button" className="btn" onClick={add} disabled={busy === 'add'} style={{ alignSelf: 'flex-start' }}>
          {busy === 'add' ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />} Tambah Foto
        </button>
      </div>
    </div>
  );
}
