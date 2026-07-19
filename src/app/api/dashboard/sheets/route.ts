import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';
import { readComputedSheets, isConfigured } from '@/lib/dashboard/source';
import { filterSheetsForRole } from '@/lib/dashboard/rls';

/** Paritas `GET /api/sheets` server.js: data live Turso sbg tab, di-RLS. */
export async function GET() {
  const g = await requireDashboardAuth('sheets');
  if (!g.ok) return g.res;
  if (!isConfigured()) return NextResponse.json({ configured: false, sheets: {} });
  try {
    const sheets = await readComputedSheets();
    return NextResponse.json({
      configured: true,
      source: 'turso',
      sheets: filterSheetsForRole(sheets, g.user.role)
    });
  } catch (e) {
    console.error('[api/dashboard/sheets] gagal baca Turso:', e);
    return NextResponse.json(
      { configured: true, source: 'turso', error: 'Terjadi kesalahan pada server.', sheets: {} },
      { status: 502 }
    );
  }
}
