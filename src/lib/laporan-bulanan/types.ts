export interface Periode {
  kode: string;
  dari: string;
  sampai: string;
  label: string;
}

export type StatusTugas = 'Selesai' | 'Proses' | 'Tertunda';

export interface DailyTaskRow {
  id: number;
  tanggal: string;
  task: string;
  pic: string | null;
  divisi: string;
  deadline: string | null;
  status: 'Pending' | 'In Progress' | 'Complete';
}
