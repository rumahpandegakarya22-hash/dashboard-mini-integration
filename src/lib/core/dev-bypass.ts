// Satu-satunya tempat yang memutuskan apakah bypass login lokal boleh aktif (dipakai auth.ts dan proxy.ts).
// Hanya `next dev` di komputer pengembang: NODE_ENV=development, DEV_BYPASS_AUTH=1 disetel manual, dan bukan di
// Vercel (semua lingkungannya) maupun CI. Di build production/preview NODE_ENV selalu "production", jadi bypass
// mati walau variabelnya tidak sengaja ikut ter-deploy.
export function bypassDevAktif(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.NODE_ENV === 'development' &&
    env.DEV_BYPASS_AUTH === '1' &&
    !env.VERCEL &&
    !env.VERCEL_ENV &&
    !env.CI
  );
}
