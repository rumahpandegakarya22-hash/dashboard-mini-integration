import { getSessionUser } from '@/lib/core/auth';
import { canAccess, ROLE_LABEL } from '@/lib/core/roles';
import { MODULES } from '@/lib/modules/registry';
import { getJoblist, joblistDivisi } from '@/lib/joblist';
import HomeGreeting from '@/components/HomeGreeting';
import HomeMenu from '@/components/HomeMenu';
import Joblist from '@/components/Joblist';
import PendingAnnouncement from '@/components/PendingAnnouncement';

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

  // Improvement v1.1 §3: tabel joblist di paling atas, grid menu modul di bawahnya.
  return (
    <>
      <HomeGreeting userName={user.name} roleLabel={ROLE_LABEL[user.role]} />
      <PendingAnnouncement role={user.role} />
      <Joblist rows={joblistRows} divisi={divisi} />
      <HomeMenu
        isOwner={user.role === 'owner'}
        canKelola={user.role === 'owner' || user.role === 'staff_admin'}
        canLandingPage={user.role === 'owner' || user.role === 'staff_admin' || user.role === 'staff_marketing'}
        canRiwayatBayar={user.role === 'owner' || user.role === 'staff_admin' || user.role === 'staff_sales'}
        canInspeksi={user.role === 'owner' || user.role === 'staff_admin' || user.role === 'staff_inspeksi'}
        modules={visible}
      />
    </>
  );
}
