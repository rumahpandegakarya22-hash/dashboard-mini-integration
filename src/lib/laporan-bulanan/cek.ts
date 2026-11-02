const ENTITAS: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export function teksPolos(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(lt|gt|quot|#39);/g, (e) => ENTITAS[e])
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const CACAT: Array<[string, RegExp]> = [
  ['NaN', /\bNaN\b/],
  ['undefined', /\bundefined\b/],
  ['[object', /\[object\b/],
  ['Infinity', /\bInfinity\b/],
  ['null', /\bnull\b/],
];

export function cariCacat(html: string): string[] {
  const teks = teksPolos(html);
  return CACAT.filter(([, re]) => re.test(teks)).map(([nama]) => nama);
}

export function urai(argv: string[]): { id: string; kode: string; html?: string; full: boolean } | null {
  const posisi: string[] = [];
  let html: string | undefined;
  let full = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--full') full = true;
    else if (a === '--html') {
      html = argv[++i];
      if (!html || html.startsWith('--')) return null;
    } else if (!a.startsWith('--')) posisi.push(a);
  }
  const [id, kode] = posisi;
  return id && kode ? { id, kode, html, full } : null;
}
