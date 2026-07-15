import { turso, DIVISI_DB, TASK_STATUS } from '../../turso';
import { parseDateISO, required } from '../../validate';
import type { SubmitHandler } from '../types';

/**
 * Daily Task per divisi (Mini App Improvement §1) — push ke database Turso
 * tabel daily_tasks (bukan Google Sheets). CHECK constraint divisi & status
 * ada di DB; divalidasi juga di sini agar pesan errornya ramah.
 */
export const submitDailyTask: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const task = required(values.task, 'Task');
  const pic = required(values.pic, 'PIC');
  const divisi = required(values.divisi, 'Divisi');
  const deadline = parseDateISO(String(values.deadline ?? ''));
  const status = required(values.status, 'Status');

  if (!(DIVISI_DB as readonly string[]).includes(divisi)) throw new Error(`Divisi tidak valid: "${divisi}".`);
  if (!(TASK_STATUS as readonly string[]).includes(status)) throw new Error(`Status tidak valid: "${status}".`);

  const res = await turso().execute({
    sql: 'INSERT INTO daily_tasks (tanggal, task, pic, divisi, deadline, status) VALUES (?, ?, ?, ?, ?, ?)',
    args: [tanggal, task, pic, divisi, deadline, status]
  });

  return {
    target: 'Turso → daily_tasks',
    row: Number(res.lastInsertRowid ?? -1),
    data: { ...values, submittedBy: ctx.user.username }
  };
};
