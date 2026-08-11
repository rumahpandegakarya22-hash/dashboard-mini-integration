export const KONDISI_ITEMS = [
  { no: 1, key: 'item01', label: 'Lantai (sapu & pel)' },
  { no: 2, key: 'item02', label: 'Dinding (bersih, tidak coret)' },
  { no: 3, key: 'item03', label: 'Plafon (tidak bocor, bersih)' },
  { no: 4, key: 'item04', label: 'Jendela & kaca' },
  { no: 5, key: 'item05', label: 'Pintu & gagang pintu' },
  { no: 6, key: 'item06', label: 'Kasur & bantal (kondisi)' },
  { no: 7, key: 'item07', label: 'Lemari pakaian (berfungsi)' },
  { no: 8, key: 'item08', label: 'Meja & kursi belajar' },
  { no: 9, key: 'item09', label: 'Rak / cermin (jika ada)' },
  { no: 10, key: 'item10', label: 'Gorden / tirai' },
  { no: 11, key: 'item11', label: 'Saklar & colokan listrik' },
  { no: 12, key: 'item12', label: 'Lampu (semua menyala)' },
  { no: 13, key: 'item13', label: 'AC (dingin, filter bersih)' },
  { no: 14, key: 'item14', label: 'Kipas angin (jika ada)' },
  { no: 15, key: 'item15', label: 'Stop kontak tambahan' },
  { no: 16, key: 'item16', label: 'Kloset (flush normal)' },
  { no: 17, key: 'item17', label: 'Shower / bak mandi' },
  { no: 18, key: 'item18', label: 'Wastafel & kran' },
  { no: 19, key: 'item19', label: 'Pintu kamar mandi' },
  { no: 20, key: 'item20', label: 'Ventilasi kamar mandi' },
  { no: 21, key: 'item21', label: 'Kunci kamar (ganti kunci?)' },
  { no: 22, key: 'item22', label: 'Gembok / kunci cadangan' },
  { no: 23, key: 'item23', label: 'Jendela bisa dikunci' },
  { no: 24, key: 'item24', label: 'Teralis (jika ada)' },
  { no: 25, key: 'item25', label: 'Port LAN / WiFi signal' },
  { no: 26, key: 'item26', label: 'Speed test (>10 Mbps)' },
] as const;

export type KondisiValue = 'Baik' | 'Perlu Perbaikan' | 'Rusak' | 'N/A';
export const KONDISI_OPTIONS: KondisiValue[] = ['Baik', 'Perlu Perbaikan', 'Rusak', 'N/A'];
export type KondisiItemKey = typeof KONDISI_ITEMS[number]['key'];
