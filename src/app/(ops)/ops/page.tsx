import { getSessionUser } from '@/lib/core/auth';
import { canAccess, canUsePreForm, ROLE_LABEL } from '@/lib/core/roles';
import { MODULES } from '@/lib/modules/registry';
import { getJoblist, joblistDivisi } from '@/lib/joblist';
import HomeGreeting from '@/components/HomeGreeting';
import HomeMenu from '@/components/HomeMenu';
import Joblist from '@/components/Joblist';
import PendingAnnouncement from '@/components/PendingAnnouncement';
import { bolehBukaLandingAdmin } from '@/lib/landing-admin';
import PengingatTagihan from '@/components/PengingatTagihan';
import { bolehLihatPengingat } from '@/lib/pengingat/tagihan';
import { muatKartuTagihan } from '@/lib/pengingat/beranda';

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

  // Data tagihan (termasuk nomor HP) hanya dibaca untuk role yang berhak.
  const bolehTagihan = bolehLihatPengingat(user.role);
  const tagihan = bolehTagihan ? await muatKartuTagihan() : null;

  // Improvement v1.1 §3: tabel joblist di atas grid menu modul; pengingat tagihan di atas keduanya.
  return (
    <>
      <HomeGreeting userName={user.name} roleLabel={ROLE_LABEL[user.role]} />
      <PendingAnnouncement role={user.role} />
      {bolehTagihan && <PengingatTagihan daftar={tagihan} />}
      <Joblist rows={joblistRows} divisi={divisi} />
      <HomeMenu
        isOwner={user.role === 'owner'}
        canKelola={user.role === 'owner' || user.role === 'admin_finance'}
        canLandingPage={bolehBukaLandingAdmin({ ops: user.role })}
        canRiwayatBayar={user.role === 'owner' || user.role === 'admin_finance' || user.role === 'sales'}
        canInspeksi={user.role === 'owner' || user.role === 'admin_finance' || user.role === 'operasional'}
        canPreForm={canUsePreForm(user.role)}
        modules={visible}
      />
    </>
  );
}
