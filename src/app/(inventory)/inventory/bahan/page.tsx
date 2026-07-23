import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/core/auth';
import { listMaterials, createMaterial, updateMaterial } from '@/lib/inventory-admin';
import { bolehKelola } from '../../akses';

async function wajibKelola() {
  const user = await getSessionUser();
  if (!user || !bolehKelola(user.role)) throw new Error('Tidak berwenang mengelola bahan.');
  return user;
}

async function tambah(formData: FormData) {
  'use server';
  const user = await wajibKelola();
  await createMaterial({
    name: String(formData.get('nama') ?? ''),
    category: String(formData.get('kategori') ?? ''),
    unit: String(formData.get('satuan') ?? ''),
    currentStock: Number(String(formData.get('stokAwal') ?? '0').replace(',', '.')) || 0,
    minStock: Number(String(formData.get('minStok') ?? '0').replace(',', '.')) || 0,
    by: user.username
  });
  revalidatePath('/inventory/bahan');
  revalidatePath('/inventory');
}

async function ubah(formData: FormData) {
  'use server';
  const user = await wajibKelola();
  await updateMaterial({
    id: Number(formData.get('id')),
    name: String(formData.get('nama') ?? ''),
    category: String(formData.get('kategori') ?? ''),
    unit: String(formData.get('satuan') ?? ''),
    minStock: Number(String(formData.get('minStok') ?? '0').replace(',', '.')) || 0,
    by: user.username
  });
  revalidatePath('/inventory/bahan');
  revalidatePath('/inventory');
}

export default async function BahanPage() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!bolehKelola(user.role)) redirect('/inventory');

  const materials = await listMaterials();

  return (
    <>
      <h1>Kelola Bahan</h1>

      <h2>Tambah bahan baru</h2>
      <form action={tambah}>
        <input name="nama" placeholder="Nama bahan" required />{' '}
        <input name="kategori" placeholder="Kategori" required />{' '}
        <input name="satuan" placeholder="Satuan (mis. botol)" required />{' '}
        <input name="stokAwal" placeholder="Stok awal" inputMode="decimal" />{' '}
        <input name="minStok" placeholder="Stok minimum" inputMode="decimal" />{' '}
        <button type="submit">Tambah</button>
      </form>

      <h2>Daftar bahan</h2>
      <p style={{ opacity: 0.7 }}>
        Stok berjalan tidak bisa diubah di sini — pakai Koreksi Stok supaya perubahan saldo punya mutasi.
      </p>
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>Kategori</th>
            <th>Satuan</th>
            <th>Min</th>
            <th>Stok kini</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id}>
              <td colSpan={6}>
                <form action={ubah} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="hidden" name="id" value={m.id} />
                  <input name="nama" defaultValue={m.name} required />
                  <input name="kategori" defaultValue={m.category} required />
                  <input name="satuan" defaultValue={m.unit} required />
                  <input name="minStok" defaultValue={m.minStock} inputMode="decimal" />
                  <span>
                    stok: {m.currentStock} {m.unit}
                  </span>
                  <button type="submit">Simpan</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
