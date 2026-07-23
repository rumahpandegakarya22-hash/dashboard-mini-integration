import type { Config } from 'tailwindcss';

/**
 * Tailwind di repo ini melayani SATU app: route group (inventory), yang di-port
 * dari app Inventory Stock lama beserta tampilannya.
 *
 * Dua pagar supaya Ops & Dashboard tidak ikut terpengaruh:
 *   1. `preflight: false` — reset global Tailwind mematikan margin heading,
 *      list style, border box, dsb. Kalau aktif, seluruh CSS hasil port di
 *      theme-ops.css / theme-dashboard.css akan berubah tanpa satu barisnya
 *      disentuh. Ini kesalahan yang sama dengan kebocoran 96 selector di 029542e.
 *   2. `content` hanya berkas Inventory — utilitas yang tidak dipakai di sana
 *      tidak ikut dihasilkan.
 *
 * Nilai `theme` disalin apa adanya dari tailwind.config.ts app lama supaya
 * tampilannya identik.
 */
const config: Config = {
  corePlugins: { preflight: false },
  // Strategi selector: setiap utilitas dihasilkan sebagai
  // `[data-app='inventory'] .flex{...}`, bukan `.flex{...}`.
  // Tanpa ini, nama utilitas yang kebetulan sama dengan kelas milik Ops/Dashboard
  // (terbukti: `.grid`, `.active`) akan saling menimpa lintas app.
  important: "[data-app='inventory']",
  content: [
    './src/app/(inventory)/**/*.{ts,tsx}',
    './src/components/inventory/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F8F6F2',
        sand: { DEFAULT: '#E8DFD5', dark: '#D8CCBD' },
        taupe: { DEFAULT: '#8E8B87', dark: '#6B6762' },
        blush: '#F2D5CF',
        ink: '#292524',
        accent: { DEFAULT: '#C92D31', dark: '#A82428', soft: '#CF7872' }
      },
      backdropBlur: { xs: '2px' },
      backgroundImage: {
        'liquid-gradient':
          'radial-gradient(55vw 55vw at 0% 0%, rgba(242, 213, 207, 0.45) 0%, transparent 65%), radial-gradient(65vw 65vw at 100% 100%, rgba(232, 223, 213, 0.6) 0%, transparent 65%), linear-gradient(160deg, #F8F6F2 0%, #F5EFE7 55%, #F0E8DC 100%)'
      },
      animation: {
        'float-slow': 'float 8s ease-in-out infinite',
        'float-medium': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-10px) scale(1.02)' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' }
        }
      }
    }
  },
  plugins: []
};

export default config;
