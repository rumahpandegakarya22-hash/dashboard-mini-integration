import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/core/auth';
import { listMaterials, postCorrection } from '@/lib/inventory-admin';
import { bolehKelola } from '../../akses';

async function simpan(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user || !bolehKelola(user.role)) throw new Error('Tidak berwenang mengoreksi stok.');

  await postCorrection({
    materialId: Number(formData.get('materialId')),
    physicalStock: Number(String(formData.get('stokFisik') ?? '').replace(',', '.')),
    reason: String(formData.get('alasan') ?? ''),
    by: user.username
  });

  revalidatePath('/inventory');
  redirect('/inventory');
}

export default async function KoreksiPage() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!bolehKelola(user.role)) redirect('/inventory');

  const materials = await listMaterials();

  return (
    <>
      <h1>Koreksi Stok</h1>
      <p style={{ opacity: 0.7 }}>
        Isi jumlah fisik hasil hitung, bukan selisihnya. Selisih dicatat otomatis sebagai mutasi koreksi.
      </p>
      <form action={simpan}>
        <p>
          <label>
            Bahan
            <br />
            <select name="materialId" required>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — sistem: {m.currentStock} {m.unit}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Stok fisik hasil hitung
            <br />
            <input name="stokFisik" inputMode="decimal" required />
          </label>
        </p>
        <p>
          <label>
            Alasan
            <br />
            <input name="alasan" required />
          </label>
        </p>
        <button type="submit">Simpan koreksi</button>
      </form>
    </>
  );
}
