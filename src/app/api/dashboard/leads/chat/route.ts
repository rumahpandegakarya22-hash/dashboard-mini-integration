import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';
import { turso } from '@/lib/core/turso';
import { nowWib } from '@/lib/core/validate';

/**
 * Catat chat pertama ke lead: dipanggil saat staf menekan tombol Chat di tabel leads.
 * Hanya mengisi sekali (chat_pertama_pada yang sudah terisi tidak ditimpa), jadi menekan
 * tombol berulang-ulang aman. Pengawas hanya membaca, tidak boleh mencatat.
 */
const BOLEH = new Set(['owner', 'marketing', 'sales']);

export async function POST(req: NextRequest) {
  const g = await requireDashboardAuth();
  if (!g.ok) return g.res;
  if (!BOLEH.has(g.user.role)) {
    return NextResponse.json({ error: 'Role ini tidak boleh mencatat chat leads.' }, { status: 403 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: 'ID lead tidak valid.' }, { status: 400 });
  }

  try {
    const sekarang = nowWib();
    const res = await turso().execute({
      sql: 'UPDATE leads SET chat_pertama_pada = ? WHERE id = ? AND chat_pertama_pada IS NULL',
      args: [sekarang, leadId]
    });
    if (res.rowsAffected === 0) {
      const ada = await turso().execute({ sql: 'SELECT chat_pertama_pada FROM leads WHERE id = ?', args: [leadId] });
      if (ada.rows.length === 0) return NextResponse.json({ error: 'Lead tidak ditemukan.' }, { status: 404 });
      return NextResponse.json({ ok: true, dicatat: false, chatPertamaPada: String(ada.rows[0].chat_pertama_pada) });
    }
    return NextResponse.json({ ok: true, dicatat: true, chatPertamaPada: sekarang });
  } catch (e) {
    console.error('[api/dashboard/leads/chat] gagal mencatat chat:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
