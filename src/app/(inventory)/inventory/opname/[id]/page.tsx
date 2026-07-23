import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/core/auth';
import { getOpname, saveOpname, type OpnameInput } from '@/lib/inventory-admin';
import { bolehKelola } from '../../../akses';

/** Baris form dikirim sebagai fisik_<materialId> / catatan_<materialId>. */
function bacaItems(formData: FormData): OpnameInput[] {
  const items: OpnameInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('fisik_')) continue;
    const materialId = Number(key.slice(6));
    const physicalStock = Number(String(value).replace(',', '.'));
    if (!Number.isInteger(materialId) || !Number.isFinite(physicalStock)) continue;
    items.push({
      materialId,
      physicalStock,
      notes: String(formData.get(`catatan_${materialId}`) ?? '').trim()
    });
  }
  return items;
}

async function simpan(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user || !bolehKelola(user.role)) throw new Error('Tidak berwenang menyimpan opname.');

  const opnameId = Number(formData.get('opnameId'));
  const finalize = formData.get('aksi') === 'finalize';
  await saveOpname({ opnameId, items: bacaItems(formData), finalize, by: user.username });

  revalidatePath(`/inventory/opname/${opnameId}`);
  revalidatePath('/inventory');
}

export default async function OpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return null;
  if (!bolehKelola(user.role)) redirect('/inventory');

  const { id } = await params;
  const data = await getOpname(Number(id));
  if (!data) notFound();

  const { opname, details } = data;
  const final = opname.status === 'FINALIZED';

  return (
    <>
      <h1>Opname {opname.period}</h1>
      <p>Status: {final ? 'Final — tidak bisa diubah' : 'Draf'}</p>

      <form action={simpan}>
        <input type="hidden" name="opnameId" value={opname.id} />
        <table>
          <thead>
            <tr>
              <th>Bahan</th>
              <th>Stok sistem</th>
              <th>Stok fisik</th>
              <th>Selisih</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => (
              <tr key={d.materialId}>
                <td>{d.materialName}</td>
                <td>
                  {d.systemStock} {d.materialUnit}
                </td>
                <td>
                  <input
                    name={`fisik_${d.materialId}`}
                    defaultValue={d.physicalStock}
                    inputMode="decimal"
                    disabled={final}
                  />
                </td>
                <td>{d.difference > 0 ? `+${d.difference}` : d.difference}</td>
                <td>
                  <input name={`catatan_${d.materialId}`} defaultValue={d.notes} disabled={final} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!final && (
          <p>
            <button type="submit" name="aksi" value="draft">
              Simpan draf
            </button>{' '}
            <button type="submit" name="aksi" value="finalize">
              Finalisasi &amp; sesuaikan stok
            </button>
          </p>
        )}
      </form>

      {!final && (
        <p style={{ opacity: 0.7 }}>
          Finalisasi mengunci laporan dan menyesuaikan stok sistem ke hitungan fisik. Tiap selisih dicatat
          sebagai mutasi koreksi, jadi perubahannya tetap terlihat di riwayat.
        </p>
      )}
    </>
  );
}
