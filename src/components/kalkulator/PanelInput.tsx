'use client';

import { Plus, Trash2 } from 'lucide-react';
import InputAngka from './InputAngka';
import TabelBaris, { MAKS_BARIS, type Kolom } from './TabelBaris';
import { biayaListrik } from '@/lib/kalkulator/hitung';
import { alatBaru, fasumBaru, itemBiayaBaru, tipeKamarBaru } from '@/lib/kalkulator/default';
import { angkaId, rp } from '@/lib/kalkulator/format';
import type { AlatListrik, BiayaAkuisisi, HasilHitung, ItemBiaya, ItemFasum, SkenarioInput } from '@/lib/kalkulator/tipe';

const R = 1e10;

const KOLOM_ALAT: Kolom<AlatListrik>[] = [
  { kunci: 'nama', label: 'Alat', jenis: 'teks' },
  { kunci: 'watt', label: 'Daya', jenis: 'angka', max: 1e5, satuan: 'W' },
  { kunci: 'jumlah', label: 'Jumlah', jenis: 'angka', max: 1e4 },
  { kunci: 'jamPerHari', label: 'Pemakaian', jenis: 'angka', max: 24, step: 0.25, satuan: 'jam/hr' },
  { kunci: 'faktorPemakaian', label: 'Faktor', jenis: 'angka', min: 1, max: 100, satuan: '%' },
  { kunci: 'aktif', label: 'Aktif', jenis: 'cek' }
];
const KOLOM_BIAYA: Kolom<ItemBiaya>[] = [
  { kunci: 'nama', label: 'Biaya', jenis: 'teks' },
  { kunci: 'nominal', label: 'Per kamar/bln', jenis: 'angka', max: R, rupiah: true },
  { kunci: 'sifat', label: 'Sifat', jenis: 'sifat' },
  { kunci: 'penyusutan', label: 'Penyusutan', jenis: 'cek' },
  { kunci: 'aktif', label: 'Aktif', jenis: 'cek' }
];
const KOLOM_FASUM: Kolom<ItemFasum>[] = [
  { kunci: 'nama', label: 'Biaya', jenis: 'teks' },
  { kunci: 'jumlah', label: 'Jumlah', jenis: 'angka', max: 1e6 },
  { kunci: 'harga', label: 'Harga/bln', jenis: 'angka', max: R, rupiah: true },
  { kunci: 'penyusutan', label: 'Penyusutan', jenis: 'cek' },
  { kunci: 'aktif', label: 'Aktif', jenis: 'cek' }
];
const KOLOM_AKUISISI: Kolom<BiayaAkuisisi>[] = [
  { kunci: 'nama', label: 'Kanal', jenis: 'teks' },
  { kunci: 'nominal', label: 'Biaya', jenis: 'angka', max: R, rupiah: true }
];

function Bagian({ judul, sub, buka = false, children }: { judul: string; sub?: string; buka?: boolean; children: React.ReactNode }) {
  return (
    <details className="card kalk-sec" open={buka}>
      <summary>
        <span className="card__title">{judul}</span>
        {sub && <span className="kalk-sec__sub">{sub}</span>}
      </summary>
      <div className="kalk-sec__body">{children}</div>
    </details>
  );
}

function Cek({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="kalk-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function PanelInput({
  input,
  ubah,
  h
}: {
  input: SkenarioInput;
  ubah: (f: (d: SkenarioInput) => void) => void;
  h: HasilHitung;
}) {
  const { hariPerBulan: hari, tarifListrik: tarif } = input.umum;
  const infoAlat = (a: AlatListrik) => `${rp(biayaListrik([a], hari, tarif).biaya)}/bln`;

  return (
    <div className="kalk-inputs">
      <Bagian judul="Umum" sub="Hari, tarif listrik, pajak" buka>
        <div className="kalk-grid2">
          <InputAngka label="Hari per bulan" value={hari} min={1} max={31} slider onChange={(v) => ubah((d) => void (d.umum.hariPerBulan = v))} />
          <InputAngka label="Tarif listrik" value={tarif} max={R} slider sliderMax={3000} rupiah satuan="/kWh" onChange={(v) => ubah((d) => void (d.umum.tarifListrik = v))} />
        </div>
        <Cek label="Hitung pajak atas pendapatan" checked={input.umum.pajakAktif} onChange={(v) => ubah((d) => void (d.umum.pajakAktif = v))} />
        {input.umum.pajakAktif && (
          <InputAngka label="Tarif pajak" value={input.umum.pajakPersen} max={100} step={0.5} slider sliderMax={30} satuan="%" onChange={(v) => ubah((d) => void (d.umum.pajakPersen = v))} />
        )}
      </Bagian>

      <Bagian judul="Tipe Kamar" sub={`${h.totalKamar} kamar · ${h.kamarTerisi} terisi`} buka>
        {input.tipeKamar.map((t, i) => {
          const hasil = h.perTipe[i];
          return (
            <div className="kalk-tipe" key={i}>
              <div className="kalk-tipe__head">
                <input
                  type="text"
                  className="kalk-tipe__nama"
                  aria-label="Nama tipe kamar"
                  maxLength={80}
                  value={t.nama}
                  onChange={(e) => ubah((d) => void (d.tipeKamar[i].nama = e.target.value))}
                />
                <button
                  type="button"
                  className="kalk-icon-btn"
                  aria-label={`Hapus tipe ${t.nama}`}
                  onClick={() => ubah((d) => void d.tipeKamar.splice(i, 1))}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <div className="kalk-grid2">
                <InputAngka
                  label="Jumlah kamar"
                  value={t.jumlahKamar}
                  max={1000}
                  slider
                  sliderMax={60}
                  onChange={(v) =>
                    ubah((d) => {
                      const x = d.tipeKamar[i];
                      x.jumlahKamar = Math.round(v);
                      x.kamarTerisi = Math.min(x.kamarTerisi, x.jumlahKamar);
                    })
                  }
                />
                <InputAngka
                  label="Kamar terisi"
                  value={t.kamarTerisi}
                  max={t.jumlahKamar}
                  slider
                  onChange={(v) => ubah((d) => void (d.tipeKamar[i].kamarTerisi = Math.round(v)))}
                />
                <InputAngka
                  label="Harga sewa / bulan"
                  value={t.hargaSewa}
                  max={R}
                  step={25_000}
                  slider
                  sliderMax={5_000_000}
                  rupiah
                  onChange={(v) => ubah((d) => void (d.tipeKamar[i].hargaSewa = v))}
                />
              </div>
              {hasil && (
                <p className="kalk-muted">
                  Listrik {rp(hasil.listrikPerKamar)} · variabel {rp(hasil.variabelPerKamar)} · tetap {rp(hasil.tetapPerKamar)} per
                  kamar/bln
                </p>
              )}
              <h4 className="kalk-sub">Alat listrik per kamar (biaya variabel)</h4>
              <TabelBaris
                baris={t.alatListrik}
                kolom={KOLOM_ALAT}
                buatBaru={alatBaru}
                labelTambah="Tambah alat"
                info={infoAlat}
                onUbah={(b) => ubah((d) => void (d.tipeKamar[i].alatListrik = b))}
              />
              <h4 className="kalk-sub">Biaya lain per kamar</h4>
              <TabelBaris
                baris={t.itemBiaya}
                kolom={KOLOM_BIAYA}
                buatBaru={itemBiayaBaru}
                labelTambah="Tambah biaya"
                onUbah={(b) => ubah((d) => void (d.tipeKamar[i].itemBiaya = b))}
              />
            </div>
          );
        })}
        <button
          type="button"
          className="kalk-btn ghost"
          disabled={input.tipeKamar.length >= MAKS_BARIS}
          onClick={() => ubah((d) => void d.tipeKamar.push(tipeKamarBaru()))}
        >
          <Plus size={15} aria-hidden /> Tambah tipe kamar
        </button>
      </Bagian>

      <Bagian judul="Biaya Bersama (Fasum)" sub="Biaya tetap yang ditanggung semua kamar">
        <TabelBaris
          baris={input.fasum}
          kolom={KOLOM_FASUM}
          buatBaru={fasumBaru}
          labelTambah="Tambah biaya"
          info={(f) => `${rp(f.jumlah * f.harga)}/bln`}
          onUbah={(b) => ubah((d) => void (d.fasum = b))}
        />
        <h4 className="kalk-sub">PBB</h4>
        <Cek label="Hitung PBB kos" checked={input.pbb.aktif} onChange={(v) => ubah((d) => void (d.pbb.aktif = v))} />
        {input.pbb.aktif && (
          <>
            <div className="kalk-grid2">
              <InputAngka label="PBB setahun (rumah + kos)" value={input.pbb.pbbTahunan} max={R} rupiah onChange={(v) => ubah((d) => void (d.pbb.pbbTahunan = v))} />
              <InputAngka label="Luas rumah" value={input.pbb.luasRumah} max={1e7} satuan="m²" onChange={(v) => ubah((d) => void (d.pbb.luasRumah = v))} />
              <InputAngka label="Luas kos" value={input.pbb.luasKos} max={1e7} satuan="m²" onChange={(v) => ubah((d) => void (d.pbb.luasKos = v))} />
            </div>
            <p className="kalk-muted">PBB porsi kos: {rp(h.pbbBulanan)}/bln (dibagi menurut luas)</p>
          </>
        )}
      </Bagian>

      <Bagian judul="Listrik Fasum" sub={`${angkaId(h.listrikFasumKwhHari)} kWh/hari · ${rp(h.listrikFasum)}/bln`}>
        <Cek label="Hitung listrik fasum" checked={input.listrikFasum.aktif} onChange={(v) => ubah((d) => void (d.listrikFasum.aktif = v))} />
        <TabelBaris
          baris={input.listrikFasum.alat}
          kolom={KOLOM_ALAT}
          buatBaru={alatBaru}
          labelTambah="Tambah alat"
          info={infoAlat}
          onUbah={(b) => ubah((d) => void (d.listrikFasum.alat = b))}
        />
      </Bagian>

      <Bagian judul="Investasi & Upgrade" sub="Modal usaha dan simulasi peningkatan fasilitas">
        <InputAngka
          label="Modal awal usaha"
          bantuan="Total modal yang ditanam. Dipakai untuk ROI dan payback usaha."
          value={input.investasi.modalAwal}
          max={1e13}
          rupiah
          onChange={(v) => ubah((d) => void (d.investasi.modalAwal = v))}
        />
        <Cek label="Aktifkan skenario upgrade" checked={input.upgrade.aktif} onChange={(v) => ubah((d) => void (d.upgrade.aktif = v))} />
        <div className="kalk-grid2">
          <InputAngka label="Biaya investasi upgrade" value={input.upgrade.biayaInvestasi} max={1e13} rupiah onChange={(v) => ubah((d) => void (d.upgrade.biayaInvestasi = v))} />
          <InputAngka
            label="Kenaikan sewa per kamar"
            value={input.upgrade.kenaikanSewaPerKamar}
            max={R}
            step={5_000}
            slider
            sliderMax={500_000}
            rupiah
            onChange={(v) => ubah((d) => void (d.upgrade.kenaikanSewaPerKamar = v))}
          />
          <InputAngka
            label="Kamar yang naik harga"
            value={Math.min(input.upgrade.kamarTerdampak, h.totalKamar)}
            max={h.totalKamar}
            slider
            onChange={(v) => ubah((d) => void (d.upgrade.kamarTerdampak = Math.round(v)))}
          />
          <InputAngka
            label="Tambahan biaya per bulan"
            value={input.upgrade.tambahanBiayaPerBulan}
            max={R}
            step={10_000}
            slider
            sliderMax={5_000_000}
            rupiah
            onChange={(v) => ubah((d) => void (d.upgrade.tambahanBiayaPerBulan = v))}
          />
        </div>
      </Bagian>

      <Bagian judul="Akuisisi Penghuni" sub="Customer Acquisition Cost">
        <TabelBaris
          baris={input.akuisisi.biaya}
          kolom={KOLOM_AKUISISI}
          buatBaru={() => ({ nama: '', nominal: 0 })}
          labelTambah="Tambah kanal"
          onUbah={(b) => ubah((d) => void (d.akuisisi.biaya = b))}
        />
        <InputAngka
          label="Jumlah penghuni baru"
          value={input.akuisisi.penghuniBaru}
          max={1e6}
          slider
          sliderMax={60}
          onChange={(v) => ubah((d) => void (d.akuisisi.penghuniBaru = Math.round(v)))}
        />
      </Bagian>

      <Bagian judul="Barang Tambahan Penghuni" sub="Bantu menentukan tagihan listrik tambahan">
        <p className="kalk-muted">Tidak masuk laba usaha. Hasilnya acuan nominal tambahan listrik yang ditagihkan ke penghuni.</p>
        <TabelBaris
          baris={input.barangTambahan.alat}
          kolom={KOLOM_ALAT}
          buatBaru={alatBaru}
          labelTambah="Tambah alat"
          info={infoAlat}
          onUbah={(b) => ubah((d) => void (d.barangTambahan.alat = b))}
        />
        <label className="kalk-field">
          <span className="kalk-field__label">Bulatkan tagihan ke atas</span>
          <select
            value={input.barangTambahan.pembulatanKe}
            onChange={(e) => ubah((d) => void (d.barangTambahan.pembulatanKe = Number(e.target.value)))}
          >
            {[0, 1_000, 5_000, 10_000].map((n) => (
              <option key={n} value={n}>
                {n ? rp(n) : 'Tanpa pembulatan'}
              </option>
            ))}
          </select>
        </label>
        <p className="kalk-hasil-kecil">
          {angkaId(h.barangTambahan.kwhBulan)} kWh/bln · biaya {rp(h.barangTambahan.biaya)} · usulan tagihan{' '}
          <b>{rp(h.barangTambahan.tarifDibulatkan)}/bln</b>
        </p>
      </Bagian>
    </div>
  );
}
