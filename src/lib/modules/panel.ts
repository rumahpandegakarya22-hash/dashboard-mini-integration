// Modul yang punya panel tugas pengelola Teman Rara (lihat komponen
// ModulePanel.tsx). Fungsi ini SENGAJA dipisah ke file non-client: ModulePanel.tsx
// butuh 'use client' (framer-motion), dan halaman modul (Server Component) tidak
// bisa memanggil fungsi biasa dari modul 'use client'.
//
// Daftar id di sini HARUS sama dengan kunci PANEL di ModulePanel.tsx.
const PANEL_MODULE_IDS = new Set(['feedback', 'pembayaran-sewa', 'penghuni-baru', 'pindah-kamar', 'checkout']);

/** Dipakai halaman modul untuk memutuskan apakah form utamanya perlu dilipat. */
export function punyaPanel(moduleId: string): boolean {
  return PANEL_MODULE_IDS.has(moduleId);
}

/** Panel yang tampil DI ATAS accordion form, bukan di bawah — untuk pindah-kamar & checkout. */
const PANEL_FIRST_IDS = new Set(['pindah-kamar', 'checkout']);
export function panelFirst(moduleId: string): boolean {
  return PANEL_FIRST_IDS.has(moduleId);
}
