// Tailwind dipakai HANYA oleh route group (inventory) — lihat tailwind.config.ts:
// preflight dimatikan dan `content` dibatasi ke berkas Inventory, supaya utilitas
// yang dihasilkan tidak pernah menyentuh Ops maupun Dashboard.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
