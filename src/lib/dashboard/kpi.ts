/* =========================================================================
   Pembaca KPI Dashboard: mengambil data mentah lalu memanggil hitungan murni
   di kpi-calc.ts. Hanya angka agregat yang keluar dari sini; baris data
   (nama, nomor HP, dst.) tidak ikut, jadi RLS tab spreadsheet tidak bocor.

   Tiap role hanya mendapat kelompok KPI miliknya; Owner dan Pengawas mendapat semua.
   ========================================================================= */

import { turso } from '@/lib/core/turso';
import { isFullView } from '@/lib/core/roles';
import { readComputedTables } from './source';
import { SLA_TARGET_HARI, HARGA_ECO_BULAN, type DbRow } from './compute';
import * as K from './kpi-calc';

export interface KpiData {
  admin?: {
    collectionRate: number | null;
    aging: K.Aging;
    dokumenLengkap: number | null;
    tutupBukuHariKerja: number | null;
    responsPengaduanJam: number | null;
    csat: number | null;
  };
  sales?: {
    konversiSurveyBooking: number | null;
    konversiLeadsSurvey: number | null;
    vacancyHari: number | null;
    renewalRate: number | null;
    responsLeadsMenit: number | null;
    waitingList: number;
    bookingBaru: number;
  };
  marketing?: {
    cpl: number | null;
    cac: number | null;
    roi: number | null;
    pencapaianTarget: number | null;
    engagement: number | null;
    konsistensi: number | null;
    bookingBaru: number;
    /** Funnel konten: jangkauan -> aksi (like+komentar+share) -> leads. */
    view: number;
    aksi: number;
    leads: number;
  };
  ops?: {
    slaPatuh: number | null;
    rasioPreventif: number | null;
    tiketBerulang: number;
    biayaPerKamar: number | null;
    kepatuhanPreventif: number | null;
    kepatuhanInspeksi: number | null;
    kamarSiapHari: number | null;
  };
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? '' : String(v));

async function query(sql: string): Promise<DbRow[]> {
  try {
    return (await turso().execute(sql)).rows.map((r) => ({ ...(r as unknown as DbRow) }));
  } catch (e) {
    console.error('[kpi] query gagal:', sql.slice(0, 60), (e as Error)?.message);
    return [];
  }
}

export async function loadKpi(role: string, range: K.Range, kapasitas: number): Promise<KpiData> {
  const full = isFullView(role);
  const want = {
    admin: full || role === 'admin_finance',
    sales: full || role === 'sales',
    marketing: full || role === 'marketing',
    ops: full || role === 'operasional'
  };
  if (!want.admin && !want.sales && !want.marketing && !want.ops) return {};

  const hariIni = K.tgl(new Date().toISOString().slice(0, 10)) as Date;
  const t = await readComputedTables();
  const out: KpiData = {};
  const inR = (v: unknown) => K.dalamRentang(v, range);

  const needInvoice = want.admin || want.sales;
  const [invoiceRows, aktifRows, siap] = await Promise.all([
    needInvoice
      ? query(
          `SELECT id_penghuni, periode_awal, periode_akhir, tanggal_pembayaran, grand_total, jumlah_bulan
           FROM invoice_sewa WHERE void_pada IS NULL AND id_penghuni IS NOT NULL AND periode_akhir IS NOT NULL`
        )
      : Promise.resolve([] as DbRow[]),
    needInvoice ? query(`SELECT id_penghuni FROM active_tenant WHERE COALESCE(id_penghuni, '') != ''`) : Promise.resolve([] as DbRow[]),
    want.ops ? query(`SELECT tanggal_checkout, kamar_siap_pada FROM checkout_log`) : Promise.resolve([] as DbRow[])
  ]);
  const invoices: K.Invoice[] = invoiceRows.map((r) => ({
    idPenghuni: str(r.id_penghuni),
    awal: str(r.periode_awal),
    akhir: str(r.periode_akhir),
    bayar: r.tanggal_pembayaran ? str(r.tanggal_pembayaran) : null,
    total: num(r.grand_total),
    bulan: num(r.jumlah_bulan)
  }));
  const aktif = new Set(aktifRows.map((r) => str(r.id_penghuni)));

  const booking = (t.booking || []).filter((b) => inR(b.tanggal_booking) && !/batal|cancel/i.test(str(b.status_booking)));
  const survey = (t.survey || []).filter((s) => inR(s.tanggal_survey));

  if (want.admin) {
    const [dok, wajib, keluhan, csat, riwayat] = await Promise.all([
      query(`SELECT id_penghuni, doc_type FROM tenant_docs`),
      query(`SELECT nilai FROM settings WHERE grup = 'DOKUMEN_WAJIB' AND kolom = 'Jenis' AND aktif = 1`),
      query(`SELECT reported_at, responded_at FROM tenant_complain`),
      query(`SELECT periode, skor FROM csat_response`),
      query(`SELECT periode, MIN(created_at) AS dibuat FROM laporan_riwayat GROUP BY periode ORDER BY periode DESC LIMIT 1`)
    ]);
    const periodeCsat = (p: unknown) => K.dalamRentang(`${str(p)}-01`, { from: range.from && new Date(range.from.getFullYear(), range.from.getMonth(), 1), to: range.to });
    out.admin = {
      collectionRate: K.collectionRate(invoices, aktif, range, hariIni),
      aging: K.agingTunggakan(invoices, aktif, hariIni),
      dokumenLengkap: K.kelengkapanDokumen(
        [...aktif],
        dok.map((d) => ({ idPenghuni: str(d.id_penghuni), jenis: str(d.doc_type) })),
        wajib.map((w) => str(w.nilai))
      ),
      tutupBukuHariKerja: riwayat[0] ? K.hariKerjaSetelahAkhirBulan(str(riwayat[0].periode), str(riwayat[0].dibuat)) : null,
      responsPengaduanJam: K.rataResponsPengaduanJam(
        keluhan.filter((k) => inR(k.reported_at)).map((k) => ({ masuk: str(k.reported_at).slice(0, 16), respons: k.responded_at ? str(k.responded_at).slice(0, 16) : null }))
      ),
      csat: K.rataSkorCsat(csat.filter((c) => periodeCsat(c.periode)).map((c) => num(c.skor)))
    };
  }

  if (want.sales) {
    const waiting = await query(`SELECT COUNT(*) AS n FROM waiting_list WHERE status IN ('Menunggu', 'Dihubungi')`);
    const leadsPeriode = (t.leads || []).filter((l) => inR(l.masuk_pada ?? l.tanggal));
    out.sales = {
      konversiSurveyBooking: K.konversiSurveyBooking(survey.length, booking.length),
      konversiLeadsSurvey: K.konversiSurveyBooking(leadsPeriode.length, survey.length),
      vacancyHari: K.rataVacancyHari(
        (t.occupancy_history || []).map((o) => ({ kamar: str(o.no_kamar), mulai: str(o.tanggal_mulai), selesai: o.tanggal_selesasi ? str(o.tanggal_selesasi) : null })),
        range
      ),
      renewalRate: K.renewalRate(invoices, range, hariIni),
      responsLeadsMenit: K.rataResponsLeadsMenit(
        (t.leads || []).filter((l) => inR(l.masuk_pada ?? l.tanggal)).map((l) => ({ masuk: l.masuk_pada ? str(l.masuk_pada) : null, chat: l.chat_pertama_pada ? str(l.chat_pertama_pada) : null }))
      ),
      waitingList: num(waiting[0]?.n),
      bookingBaru: booking.length
    };
  }

  if (want.marketing) {
    const promosi = (t.promotion || []).filter((p) => inR(p.tgl_mulai));
    const konten = (t.content || []).filter((c) => inR(c.tgl_post));
    const spend = promosi.reduce((s, p) => s + num(p.spend_aktual), 0);
    const bookingPromo = promosi.reduce((s, p) => s + num(p.booking_dr_promo), 0);
    out.marketing = {
      cpl: K.cplRata(promosi.map((p) => ({ spend: num(p.spend_aktual), leads: num(p.leads_aktual) }))),
      cac: K.cac(spend, konten.reduce((s, c) => s + num(c.biaya_produksi), 0), booking.length),
      // Sama dengan rumus "ROI Kotor" spreadsheet asli: (booking x tarif Eco - spend) / spend.
      roi: spend > 0 ? Math.round(((bookingPromo * HARGA_ECO_BULAN - spend) / spend) * 100) : null,
      pencapaianTarget: K.pencapaianTargetLeads(promosi.map((p) => ({ leads: num(p.leads_aktual), target: num(p.target_leads) }))),
      engagement: K.engagementRate(konten.map((c) => ({ likes: num(c.likes), komentar: num(c.komentar), share: num(c.share_saves), reach: num(c.reach) }))),
      konsistensi: K.konsistensiPosting(konten.map((c) => ({ status: str(c.status), tanggal: str(c.tgl_post) })), hariIni),
      bookingBaru: booking.length,
      view: konten.reduce((s, c) => s + num(c.reach), 0),
      aksi: konten.reduce((s, c) => s + num(c.likes) + num(c.komentar) + num(c.share_saves), 0),
      leads: (t.leads || []).filter((l) => inR(l.masuk_pada ?? l.tanggal)).length
    };
  }

  if (want.ops) {
    const [insKeb, insFas] = await Promise.all([
      query(`SELECT tanggal FROM inspeksi_kebersihan`),
      query(`SELECT tanggal FROM inspeksi_fasilitas`)
    ]);
    const cm = (t.maintenance_cm || []).filter((r) => inR(r.tanggal_lapor));
    const pm = (t.maintenance_pm || []).filter((r) => inR(r.tanggal_lapor));
    const biaya = [...cm, ...pm].reduce((s, r) => s + num(r.biaya), 0);
    out.ops = {
      slaPatuh: K.slaPatuh(cm.map((r) => ({ sla: r.sla }))),
      rasioPreventif: cm.length + pm.length ? Math.round((pm.length / (cm.length + pm.length)) * 1000) / 10 : null,
      tiketBerulang: K.tiketBerulang(cm.map((r) => ({ lokasi: str(r.lokasi_item), kategori: str(r.kategori) }))),
      biayaPerKamar: kapasitas > 0 ? Math.round(biaya / kapasitas) : null,
      kepatuhanPreventif: K.kepatuhanPreventif(pm.map((r) => ({ jadwal: str(r.tanggal_lapor), selesai: r.tanggal_selesai ? str(r.tanggal_selesai) : null })), hariIni),
      kepatuhanInspeksi: K.kepatuhanInspeksi([...insKeb, ...insFas].map((r) => str(r.tanggal)), range, hariIni),
      kamarSiapHari: K.rataKamarSiapHari(
        siap.filter((r) => inR(r.tanggal_checkout)).map((r) => ({ checkout: str(r.tanggal_checkout), siap: r.kamar_siap_pada ? str(r.kamar_siap_pada) : null }))
      )
    };
  }

  return out;
}

export { SLA_TARGET_HARI };
