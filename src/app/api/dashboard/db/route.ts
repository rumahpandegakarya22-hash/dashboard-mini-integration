import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';
import { readComputedTables, isConfigured } from '@/lib/dashboard/source';
import { filterTablesForRole } from '@/lib/dashboard/rls';

/** Paritas `GET /api/db` server.js: data Turso terhitung per tabel, di-RLS. */
export async function GET() {
  const g = await requireDashboardAuth('db');
  if (!g.ok) return g.res;
  if (!isConfigured()) return NextResponse.json({ configured: false, tables: {} });
  try {
    const tables = await readComputedTables();
    return NextResponse.json({ configured: true, tables: filterTablesForRole(tables, g.user.role) });
  } catch (e) {
    console.error('[api/dashboard/db] gagal baca Turso:', e);
    return NextResponse.json(
      { configured: true, error: 'Terjadi kesalahan pada server.', tables: {} },
      { status: 502 }
    );
  }
}
