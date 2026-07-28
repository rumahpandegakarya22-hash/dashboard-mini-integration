'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, CircleAlert, Eye, EyeOff, LoaderCircle, Trash2, Wifi } from 'lucide-react';
import Modal from './Modal';

interface Kamar {
  idKamar: string;
  noKamar: number;
  tipe: string;
  penghuni: string | null;
  ssid: string;
  password: string;
  catatan: string;
  diubah: string | null;
  diubahOleh: string | null;
}

type Draft = { ssid: string; password: string; catatan: string };

/**
 * Kredensial WiFi per kamar, disajikan bento: 30 kartu ringkas yang bisa
 * dipindai sekaligus, dan detail satu kamar dibuka di modal.
 *
 * Sebelumnya semua kamar merender form penuh sekaligus — 30 kamar × 3 input +
 * tombol, jadi menemukan satu kamar berarti menggulir melewati puluhan kolom
 * isian yang tidak sedang disentuh.
 *
 * Tombol Simpan & Hapus sengaja hanya ada di dalam modal: aksinya mengubah
 * kredensial yang dipakai penghuni, dan tombol semacam itu tidak pantas
 * berjajar puluhan di layar ringkasan.
 *
 * Password ditampilkan tertutup — bukan karena pengelola tidak boleh melihat
 * (justru itu tugasnya), tapi supaya tidak terpampang saat layar dibuka di
 * depan orang lain.
 */
export default function WifiPanel() {
  const [data, setData] = useState<Kamar[] | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [terlihat, setTerlihat] = useState<Record<string, boolean>>({});
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [hanyaKosong, setHanyaKosong] = useState(false);

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/ops/admin/wifi');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setData(json.data);
      setDraft(
        Object.fromEntries(
          (json.data as Kamar[]).map((k) => [k.idKamar, { ssid: k.ssid, password: k.password, catatan: k.catatan }])
        )
      );
    } catch (e: any) {
      setError(e.message || 'Gagal memuat.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function simpan(k: Kamar) {
    const d = draft[k.idKamar];
    if (!d) return;
    setBusy(k.idKamar);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/wifi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idKamar: k.idKamar, ...d })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setInfo(`Kredensial WiFi kamar ${k.noKamar} tersimpan.`);
      setTerbuka(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan.');
    } finally {
      setBusy(null);
    }
  }

  async function hapus(k: Kamar) {
    if (!confirm(`Hapus kredensial WiFi kamar ${k.noKamar}? Penghuninya akan melihat kartu WiFi kosong.`)) return;
    setBusy(k.idKamar);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/ops/admin/wifi?idKamar=${encodeURIComponent(k.idKamar)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus.');
      setInfo(`Kredensial WiFi kamar ${k.noKamar} dihapus.`);
      setTerbuka(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal menghapus.');
    } finally {
      setBusy(null);
    }
  }

  const ubah = (id: string, patch: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const belumDiisi = data?.filter((k) => !k.ssid).length ?? 0;
  const tampil = hanyaKosong ? data?.filter((k) => !k.ssid) : data;

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

      {belumDiisi > 0 && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>
            {belumDiisi} kamar belum punya kredensial WiFi — penghuninya melihat kartu WiFi kosong di aplikasi.
          </span>
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className={hanyaKosong ? 'btn secondary' : 'btn'} onClick={() => setHanyaKosong(false)}>
          Semua Kamar
        </button>
        <button type="button" className={hanyaKosong ? 'btn' : 'btn secondary'} onClick={() => setHanyaKosong(true)}>
          Belum Diisi
        </button>
      </div>

      {data === null && (
        <div className="card" aria-busy="true" aria-label="Memuat daftar kamar">
          <div className="skeleton" style={{ height: 20, width: '40%' }} />
          <div className="skeleton" style={{ height: 56, marginTop: 14 }} />
        </div>
      )}

      {tampil?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {hanyaKosong ? 'Semua kamar sudah punya kredensial WiFi.' : 'Belum ada data kamar.'}
          </p>
        </div>
      )}

      <div className="bento-grid">
        {tampil?.map((k) => {
          const d = draft[k.idKamar] ?? { ssid: '', password: '', catatan: '' };
          const berubah = d.ssid !== k.ssid || d.password !== k.password || d.catatan !== k.catatan;
          const open = terbuka === k.idKamar;
          return (
            <div key={k.idKamar} className="bento-card border-beam" data-alert={!k.ssid}>
              <button
                type="button"
                className="bento-head"
                aria-haspopup="dialog"
                onClick={() => setTerbuka(k.idKamar)}
              >
                <span className={k.ssid ? 'icon-tile' : 'icon-tile warn'} aria-hidden>
                  <Wifi size={18} />
                </span>
                <span className="bento-meta">
                  <span className="bento-title">Kamar {k.noKamar}</span>
                  <span className="bento-sub">
                    {k.ssid ? k.ssid : 'Belum ada kredensial'}
                    {k.penghuni ? ` · ${k.penghuni}` : ' · kosong'}
                  </span>
                </span>
                <ChevronRight size={20} className="accordion-chevron" aria-hidden />
              </button>

              <Modal open={open} title={`Kamar ${k.noKamar}`} onClose={() => setTerbuka(null)}>
                <div className="form-col">
                    <div className="field">
                      <label htmlFor={`ssid-${k.idKamar}`}>
                        Nama Jaringan (SSID) <span className="req">*</span>
                      </label>
                      <input
                        id={`ssid-${k.idKamar}`}
                        maxLength={64}
                        value={d.ssid}
                        onChange={(e) => ubah(k.idKamar, { ssid: e.target.value })}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`pw-${k.idKamar}`}>
                        Password <span className="req">*</span>
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id={`pw-${k.idKamar}`}
                          type={terlihat[k.idKamar] ? 'text' : 'password'}
                          maxLength={128}
                          value={d.password}
                          onChange={(e) => ubah(k.idKamar, { password: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ width: 'auto', flex: 'none', padding: '0 14px' }}
                          aria-label={terlihat[k.idKamar] ? 'Sembunyikan password' : 'Tampilkan password'}
                          onClick={() => setTerlihat((p) => ({ ...p, [k.idKamar]: !p[k.idKamar] }))}
                        >
                          {terlihat[k.idKamar] ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor={`catatan-${k.idKamar}`}>Catatan</label>
                      <input
                        id={`catatan-${k.idKamar}`}
                        maxLength={500}
                        value={d.catatan}
                        placeholder="Mis. router di koridor lantai 2"
                        onChange={(e) => ubah(k.idKamar, { catatan: e.target.value })}
                      />
                    </div>

                    {k.diubahOleh && (
                      <p className="muted" style={{ fontSize: '0.75rem', marginBottom: 10 }}>
                        Terakhir diubah {k.diubah} oleh {k.diubahOleh}
                      </p>
                    )}

                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn"
                        disabled={busy === k.idKamar || !berubah || !d.ssid.trim() || !d.password.trim()}
                        onClick={() => simpan(k)}
                      >
                        {busy === k.idKamar && <LoaderCircle size={18} className="spin" />}
                        Simpan
                      </button>
                      {k.ssid && (
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={busy === k.idKamar}
                          onClick={() => hapus(k)}
                        >
                          <Trash2 size={16} />
                          Hapus
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
