import fs from 'node:fs';
import path from 'node:path';

/**
 * Ubah HTML invoice jadi PDF A4 memakai Chromium headless.
 *
 * Dua lingkungan, dua sumber Chromium:
 *   - Vercel/Lambda → @sparticuz/chromium (build Chromium khusus serverless)
 *   - lokal (Windows/mac/Linux) → Chrome/Edge yang sudah terpasang di mesin
 * Pemilihannya lewat env VERCEL/AWS_LAMBDA_FUNCTION_NAME, bukan tebak-tebakan OS.
 */
export async function htmlKePdf(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core');
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  const opts = serverless ? await opsiServerless() : opsiLokal();
  const browser = await puppeteer.default.launch(opts);
  try {
    const page = await browser.newPage();
    // 'load' cukup: font dan logo ditanam sebagai data URI, jadi tidak ada
    // request jaringan yang perlu ditunggu saat render.
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function opsiServerless() {
  const chromium = (await import('@sparticuz/chromium')).default;
  return {
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true
  };
}

function opsiLokal() {
  const exe = process.env.CHROME_PATH || cariChromeLokal();
  if (!exe) {
    throw new Error('Chrome/Edge tidak ditemukan untuk render PDF — set CHROME_PATH ke lokasi chrome.exe.');
  }
  return { executablePath: exe, headless: true, args: ['--no-sandbox'] };
}

function cariChromeLokal(): string | null {
  const kandidat = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ];
  return kandidat.find((p) => fs.existsSync(p)) ?? null;
}

/**
 * Font ditanam sebagai data URI di dalam HTML, bukan diambil dari jaringan.
 * Chromium headless tidak punya font Lora/Poppins, dan mengambilnya dari Google
 * Fonts saat render berarti PDF bergantung pada koneksi keluar setiap kali.
 */
let _fontCss: string | null = null;

export function cssFont(): string {
  if (_fontCss) return _fontCss;
  const dir = path.join(process.cwd(), 'src', 'lib', 'invoice', 'fonts');
  const muat = (nama: string) => fs.readFileSync(path.join(dir, nama)).toString('base64');

  // Lora WAJIB versi statis per weight, bukan variable font. Variable font tampil
  // benar di layar tapi mesin cetak PDF Chromium (Skia) tidak menanamkannya —
  // hasilnya diam-diam jatuh ke font lain tanpa error sama sekali.
  _fontCss = `
    @font-face { font-family: 'Lora'; font-weight: 600; font-style: normal;
      src: url(data:font/woff2;base64,${muat('lora-latin-600-normal.woff2')}) format('woff2'); }
    @font-face { font-family: 'Lora'; font-weight: 700; font-style: normal;
      src: url(data:font/woff2;base64,${muat('lora-latin-700-normal.woff2')}) format('woff2'); }
    @font-face { font-family: 'Lora'; font-weight: 600; font-style: italic;
      src: url(data:font/woff2;base64,${muat('lora-latin-600-italic.woff2')}) format('woff2'); }
    @font-face { font-family: 'Poppins'; font-weight: 500; font-style: normal;
      src: url(data:font/ttf;base64,${muat('Poppins-Medium.ttf')}) format('truetype'); }
    @font-face { font-family: 'Poppins'; font-weight: 700; font-style: normal;
      src: url(data:font/ttf;base64,${muat('Poppins-Bold.ttf')}) format('truetype'); }
  `;
  return _fontCss;
}
