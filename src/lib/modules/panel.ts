// Modul yang punya panel tugas pengelola Teman Rara (lihat komponen
// ModulePanel.tsx). Fungsi ini SENGAJA dipisah ke file non-client: ModulePanel.tsx
// butuh 'use client' (framer-motion), dan halaman modul (Server Component) tidak
// bisa memanggil fungsi biasa dari modul 'use client'.
//
// Daftar id di sini HARUS sama dengan kunci PANEL di ModulePanel.tsx.
const PANEL_MODULE_IDS = new Set(['feedback', 'pembayaran-sewa', 'penghuni-baru']);

/** Dipakai halaman modul untuk memutuskan apakah form utamanya perlu dilipat. */
export function punyaPanel(moduleId: string): boolean {
  return PANEL_MODULE_IDS.has(moduleId);
}
