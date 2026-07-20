/* Badge status — mengangkat pola `<span class="status ...">` yang tersebar di
   `table()` public/app.js jadi satu komponen (Fase 4).

   Nama kelas status di-port apa adanya dari CSS (.s-complete, .s-progress,
   .s-pending, .s-approved, dst) supaya tampilannya identik. */

export interface BadgeProps {
  children: React.ReactNode;
  /** Kelas status dari CSS lama, mis. 's-complete' | 's-progress' | 's-pending'. */
  tone?: string;
}

export default function Badge({ children, tone }: BadgeProps) {
  return <span className={`status ${tone ?? ''}`.trim()}>{children}</span>;
}
