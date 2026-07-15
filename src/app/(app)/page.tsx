import { getSessionUser } from '@/lib/auth';
import { canAccess, ROLE_LABEL } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import { getJoblist, joblistDivisi } from '@/lib/joblist';
import HomeMenu from '@/components/HomeMenu';
import Joblist from '@/components/Joblist';

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return null; // (app)/layout sudah redirect

  const visible = MODULES.filter((m) => canAccess(user.role, m.id)).map((m) => ({ id: m.id, title: m.title }));

  // Joblist WO divisi user (owner/pengawas: semua divisi). Gagal baca DB tidak
  // boleh merobohkan home — form input tetap harus bisa dipakai di lapangan.
  const divisi = joblistDivisi(user.role);
  let joblistRows: Awaited<ReturnType<typeof getJoblist>> = [];
  try {
    joblistRows = await getJoblist(divisi);
  } catch (e) {
    console.error('[joblist] gagal membaca work_orders:', e);
  }

  return (
    <>
      <HomeMenu userName={user.name} roleLabel={ROLE_LABEL[user.role]} isOwner={user.role === 'owner'} modules={visible} />
      <Joblist rows={joblistRows} divisi={divisi} />
    </>
  );
}
