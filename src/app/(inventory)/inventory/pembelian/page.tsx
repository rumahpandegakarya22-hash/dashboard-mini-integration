import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/core/auth';
import { fetchMaterials, postPurchase } from '@/lib/inventory';

/** Input pembelian stok. Menyentuh uang, jadi dibatasi Owner/Pengawas. */
function boleh(role: string) {
  return role === 'owner' || role === 'pengawas';
}

async function simpan(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user || !boleh(user.role)) throw new Error('Tidak berwenang mencatat pembelian.');

  const catatan = String(formData.get('catatan') ?? '').trim();
  await postPurchase({
    materialId: Number(formData.get('materialId')),
    quantity: Number(String(formData.get('jumlah') ?? '').replace(',', '.')),
    totalPrice: Number(String(formData.get('totalHarga') ?? '').replace(/[^\d.]/g, '')),
    purchaseDate: String(formData.get('tanggal') ?? ''),
    notes: `${user.username}${catatan ? ` — ${catatan}` : ''}`
  });

  revalidatePath('/inventory');
  redirect('/inventory');
}

export default async function PembelianPage() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!boleh(user.role)) redirect('/inventory');

  const materials = await fetchMaterials('');

  return (
    <>
      <h1>Input Pembelian Stok</h1>
      <p>
        <Link href="/inventory">← Stok Inventory</Link>
      </p>
      <form action={simpan}>
        <p>
          <label>
            Bahan
            <br />
            <select name="materialId" required>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.currentStock} {m.unit})
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            Jumlah beli
            <br />
            <input name="jumlah" inputMode="decimal" required />
          </label>
        </p>
        <p>
          <label>
            Total harga (Rp)
            <br />
            <input name="totalHarga" inputMode="numeric" required />
          </label>
        </p>
        <p>
          <label>
            Tanggal beli
            <br />
            <input type="date" name="tanggal" required />
          </label>
        </p>
        <p>
          <label>
            Catatan
            <br />
            <input name="catatan" />
          </label>
        </p>
        <button type="submit">Simpan</button>
      </form>
    </>
  );
}
