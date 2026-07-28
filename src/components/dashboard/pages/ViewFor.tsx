import DataTablePage from './DataTablePage';
import PembayaranPage from './PembayaranPage';
import Rooms from './Rooms';
import Reveal from '@/components/ui/Reveal';
import { COLS } from '@/config/dashboard-cols';
import {
  logbookForRole,
  dokumenRows,
  vendorRows,
  tiketRows,
  inventoryOverview
} from '@/lib/dashboard/views/pages';
import InventoryOverview from '../overviews/InventoryOverview';
import type { DashboardPageData } from '@/lib/dashboard/views/load';
import type { DashboardRole } from '@/config/dashboard-access';

/* Pemetaan view → isi halaman data. Padanan properti `render:` objek ROLES
   public/app.js untuk view bergrup "page".

   Semua tabel memakai data hasil hidrasi apa adanya — TANPA fallback sintetis
   (§4.7). Sumber kosong → tabel menampilkan empty-state. */

export interface ViewForProps {
  view: string;
  role: DashboardRole;
  loaded: DashboardPageData;
  period: string;
}

/** Beberapa tabel memakai key `name` untuk kolom Nama; hidrasi mengisi `nama`. */
const withName = <T extends Record<string, any>>(rows: T[], key: string) =>
  rows.map((r) => ({ ...r, name: r[key] ?? r.name }));

export default function ViewFor({ view, role, loaded, period }: ViewForProps) {
  const d = loaded.data;

  switch (view) {
    case 'penghuni': {
      // Sales memakai set kolom ringkas (tanpa PII) — verbatim pagePenghuniSales.
      const cols = role === 'sales' ? COLS.penghuniSales : COLS.penghuni;
      return (
        <Reveal tier={0}>
          <DataTablePage
            title="DAFTAR PENGHUNI"
            cols={cols}
            data={withName(d.penghuni, 'nama')}
            period={period}
          />
        </Reveal>
      );
    }

    case 'pembayaran':
      return (
        <Reveal tier={0}>
          <PembayaranPage pembayaran={d.pembayaran} period={period} />
        </Reveal>
      );

    case 'vendor': {
      // Operasional mendapat kolom tambahan WhatsApp — verbatim COLS.vendorOps.
      const cols = role === 'operasional' ? COLS.vendorOps : COLS.vendor;
      return (
        <Reveal tier={0}>
          <DataTablePage title="DAFTAR VENDOR" cols={cols} data={vendorRows(d)} period={period} />
        </Reveal>
      );
    }

    case 'kamar':
      return (
        <Reveal tier={0}>
          <Rooms rooms={d.rooms} variant={role === 'operasional' ? 'ops' : undefined} />
        </Reveal>
      );

    case 'tiket':
      return (
        <Reveal tier={0}>
          <DataTablePage title="DAFTAR TIKET" cols={COLS.tiket} data={tiketRows(d)} period={period} />
        </Reveal>
      );

    case 'leads':
      // Marketing: Leads dan Survey ditumpuk — verbatim stackTables(...).
      return (
        <div className="view">
          <Reveal tier={0}>
            <DataTablePage title="DAFTAR LEADS" cols={COLS.leads} data={d.leads} period={period} />
          </Reveal>
          <Reveal tier={1}>
            <DataTablePage
              title="DAFTAR SURVEY"
              cols={COLS.prospek}
              data={withName(d.survey, 'nama')}
              period={period}
            />
          </Reveal>
        </div>
      );

    case 'prospek':
      return (
        <Reveal tier={0}>
          <DataTablePage
            title="DAFTAR PROSPEK"
            cols={COLS.prospek}
            data={withName(d.survey, 'nama')}
            period={period}
          />
        </Reveal>
      );

    case 'dokumen': {
      const cols = role === 'owner' ? COLS.dokumenOwner : COLS.dokumen;
      return (
        <Reveal tier={0}>
          <DataTablePage
            title={'DOKUMEN ' + role.toUpperCase()}
            cols={cols}
            data={dokumenRows(d.dokumen, role)}
            period={period}
          />
        </Reveal>
      );
    }

    case 'stok': {
      const inv = inventoryOverview(loaded.inventory);
      if (!inv) {
        return (
          <Reveal tier={0}>
            <section className="table-block">
              <h2 className="section-title">STOK INVENTORY</h2>
              <p style={{ padding: '12px 4px', opacity: 0.7 }}>
                Data stok belum tersedia — integrasi app Inventory Stock belum dikonfigurasi atau kamu tidak
                punya akses.
              </p>
            </section>
          </Reveal>
        );
      }
      return <InventoryOverview inv={inv} period={period} />;
    }

    case 'logbook': {
      const rows = logbookForRole(d.logbook, role);
      // Operasional: dipecah 3 tabel per divisi — verbatim cabang data live.
      if (role === 'operasional') {
        const byDiv = (div: string) => rows.filter((r) => r.divisi === div);
        return (
          <div className="view">
            <Reveal tier={0}>
              <DataTablePage title="Logbook Inspeksi" titleRight cols={COLS.logbook} data={byDiv('Inspeksi')} period={period} />
            </Reveal>
            <Reveal tier={1}>
              <DataTablePage title="Logbook Maintenance" titleRight cols={COLS.logbook} data={byDiv('Maintenance')} period={period} />
            </Reveal>
            <Reveal tier={2}>
              <DataTablePage title="Logbook Kebersihan" titleRight cols={COLS.logbook} data={byDiv('Kebersihan')} period={period} />
            </Reveal>
          </div>
        );
      }
      const title =
        role === 'owner'
          ? 'LOGBOOK · SEMUA DIVISI'
          : role === 'admin'
            ? 'LOGBOOK ADMIN & KEUANGAN'
            : 'LOGBOOK ' + role.toUpperCase();
      return (
        <Reveal tier={0}>
          <DataTablePage title={title} titleRight cols={COLS.logbook} data={rows} period={period} />
        </Reveal>
      );
    }

    default:
      return null;
  }
}
