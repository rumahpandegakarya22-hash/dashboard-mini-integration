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
