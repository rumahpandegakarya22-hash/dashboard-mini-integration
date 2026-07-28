import PengaduanPanel from './PengaduanPanel';
import ReviewPendaftaranPanel from './ReviewPendaftaranPanel';
import VerifikasiBuktiPanel from './VerifikasiBuktiPanel';

/**
 * Panel tugas pengelola yang menempel di bawah form modul tertentu.
 *
 * Tiga tugas dari aplikasi penghuni Teman Rara — menanggapi pengaduan,
 * memverifikasi bukti bayar, meninjau pendaftaran — datanya sudah punya
 * "rumah" di modul yang ada, jadi panelnya ditempelkan ke situ alih-alih
 * membuat menu baru yang isinya tumpang tindih.
 *
 * Form input di atas panel TIDAK digantikan: ketiganya tetap satu-satunya
 * jalur pencatatan manual (booking walk-in, pembayaran tunai, feedback lisan).
 */
const PANEL: Record<string, () => React.ReactNode> = {
  feedback: () => <PengaduanPanel />,
  'pembayaran-sewa': () => <VerifikasiBuktiPanel />,
  'penghuni-baru': () => <ReviewPendaftaranPanel />
};

/** Dipakai halaman modul untuk memutuskan apakah form utamanya perlu dilipat. */
export function punyaPanel(moduleId: string): boolean {
  return moduleId in PANEL;
}

export default function ModulePanel({ moduleId }: { moduleId: string }) {
  const render = PANEL[moduleId];
  return render ? <>{render()}</> : null;
}
