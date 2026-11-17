/* Kepala laporan divisi: banner merah, subjudul, dan baris periode (gaya Owner Review). */
export function kepalaLaporan(judul: string, subJudul: string, baris: string): string {
  return `<h1>${judul}</h1>
<h2 class="sub">${subJudul}</h2>
<p class="meta">${baris}</p>`;
}
