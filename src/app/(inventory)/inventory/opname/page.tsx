import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/core/auth';
import { listOpnames, createOpname } from '@/lib/inventory-admin';
import { bolehKelola } from '../../akses';

async function buat(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user || !bolehKelola(user.role)) throw new Error('Tidak berwenang membuat opname.');
  const id = await createOpname(String(formData.get('periode') ?? ''), user.username);
  redirect(`/inventory/opname/${id}`);
}

export default async function OpnamePage() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!bolehKelola(user.role)) redirect('/inventory');

  const opnames = await listOpnames();

  return (
    <>
      <h1>Stock Opname</h1>

      <form action={buat}>
        <label>
          Periode baru{' '}
          <input name="periode" type="month" required />
        </label>{' '}
        <button type="submit">Buka draf</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Periode</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {opnames.map((o) => (
            <tr key={o.id}>
              <td>{o.period}</td>
              <td>{o.status === 'FINALIZED' ? 'Final' : 'Draf'}</td>
              <td>
                <Link href={`/inventory/opname/${o.id}`}>Buka</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
