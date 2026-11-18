/* =========================================================================
   Parser ekspor HTML Google Docs "Kumpulan Template Pesan Admin" → daftar template.

   Aturan dokumen (lihat bagian CARA PAKAI di dokumennya):
     • Judul bab  = heading 1 ("BAB I — ...").
     • Judul template = heading 2 bernomor ("1. Jadwal Perawatan Rutin AC", "5b. ...").
     • Tiap template = satu tabel: baris 1 banner judul, baris 2 isi pesan, baris 3 (bila ada) catatan untuk admin.
     • Placeholder = teks TEBAL berwarna biru tua (#1f4e79) dalam tanda kurung siku, mis. [Jam].
       Teks bertanda kurung lain yang bukan tebal-biru-tua tidak dianggap placeholder.
   Di data, placeholder ditulis {{Label}}. Tanda *...* (tebal WhatsApp) sudah ada apa adanya di teks dokumen.
   ========================================================================= */

export interface TemplateInfo {
  no: string;
  bab: string;
  judul: string;
  /** Isi pesan; placeholder berbentuk {{Label}}. */
  isi: string;
  /** Catatan untuk admin (tidak ikut terkirim). */
  catatan?: string;
}

const WARNA_PLACEHOLDER = '#1f4e79';

const ENTITAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•'
};

export function dekodeEntitas(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, k: string) => {
    if (k[0] === '#') {
      const kode = k[1].toLowerCase() === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(kode) ? String.fromCodePoint(kode) : m;
    }
    return ENTITAS[k.toLowerCase()] ?? m;
  });
}

const adalahPlaceholder = (style: string) =>
  style.toLowerCase().replace(/\s/g, '').includes(`color:${WARNA_PLACEHOLDER}`) && /font-weight:(700|bold)/i.test(style);

export function parseTemplateHtml(html: string): TemplateInfo[] {
  const hasil: TemplateInfo[] = [];
  const token = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;

  let bab = '';
  let judul: { no: string; judul: string } | null = null;
  let kepalaDi: 'h1' | 'h2' | null = null;
  let teksKepala = '';

  let kedalamanTabel = 0;
  let baris: string[][] = []; // baris tabel aktif: tiap sel = daftar paragraf
  let sel: string[] | null = null;
  let paragraf: string | null = null;
  let biruTebal = false;

  const tutupParagraf = () => {
    if (paragraf !== null && sel) sel.push(paragraf);
    paragraf = null;
  };
  const tutupSel = () => {
    tutupParagraf();
    if (sel) baris[baris.length - 1]?.push(sel.join('\n').replace(/^\n+|\n+$/g, '').trim());
    sel = null;
  };

  const selesaiTabel = () => {
    if (judul && baris.length >= 2) {
      const [, isiBaris, ...sisa] = baris;
      const t: TemplateInfo = { no: judul.no, bab, judul: judul.judul, isi: isiBaris.join('\n').trim() };
      const catatan = sisa.map((r) => r.join('\n').trim()).filter(Boolean).join('\n');
      if (catatan) t.catatan = catatan;
      hasil.push(t);
      judul = null;
    }
    baris = [];
  };

  let m: RegExpExecArray | null;
  while ((m = token.exec(html))) {
    if (m[4] !== undefined) {
      const teks = dekodeEntitas(m[4]);
      if (kepalaDi) teksKepala += teks;
      else if (kedalamanTabel > 0 && sel) {
        if (paragraf === null) paragraf = '';
        paragraf += biruTebal ? teks.replace(/\[([^\[\]]+)\]/g, '{{$1}}') : teks;
      }
      continue;
    }
    const tutup = m[1] === '/';
    const tag = m[2].toLowerCase();
    const atribut = m[3] ?? '';

    if (tag === 'h1' || tag === 'h2') {
      if (!tutup) {
        kepalaDi = tag;
        teksKepala = '';
      } else if (kepalaDi === tag) {
        const t = teksKepala.replace(/\s+/g, ' ').trim();
        if (tag === 'h1' && /^BAB\b/i.test(t)) bab = t;
        if (tag === 'h2') {
          const n = /^(\d+[a-z]?)\.\s*(.+)$/i.exec(t);
          judul = n ? { no: n[1], judul: n[2] } : null;
        }
        kepalaDi = null;
      }
    } else if (tag === 'table') {
      if (!tutup) {
        if (kedalamanTabel === 0) baris = [];
        kedalamanTabel++;
      } else if (--kedalamanTabel === 0) selesaiTabel();
    } else if (kedalamanTabel > 0) {
      if (tag === 'tr' && !tutup) baris.push([]);
      else if (tag === 'td' && !tutup) {
        tutupSel();
        sel = [];
      } else if (tag === 'td' && tutup) tutupSel();
      else if (tag === 'p') {
        if (!tutup) paragraf = '';
        else tutupParagraf();
      } else if (tag === 'br' && !tutup && sel) paragraf = (paragraf ?? '') + '\n';
      else if (tag === 'span') {
        biruTebal = !tutup && adalahPlaceholder(atribut);
      }
    }
  }
  return hasil;
}
