// Kelola bahan (CRUD), koreksi stok, dan stock opname di DB Inventory.
// Port dari /api/materials, branch CORRECTION /api/transactions, dan /api/opname
// app lama. Dipisah dari lib/inventory.ts karena ini jalur Owner, bukan jalur
// staf lapangan — yang dipakai modul Mini App tetap di sana.
//
// Semua tulisan atas nama svc-miniapp; alasan foreign key ada di postPurchase().

import { getInventoryClient, invalidateInventoryCache } from './dashboard/inventory';
import { SERVICE_USER_ID } from './inventory';

type Executor = { execute: (q: { sql: string; args: any[] }) => Promise<any> };

const now = () => Math.floor(Date.now() / 1000);

async function logActivity(tx: Executor, action: string, target: string) {
  await tx.execute({
    sql: 'INSERT INTO activity_logs (user_id, action, target_data, created_at) VALUES (?, ?, ?, ?)',
    args: [SERVICE_USER_ID, action, target, now()]
  });
}

export interface MaterialRow {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  description: string;
  kondisi: string;
}

export interface AlatRow {
  id: number;
  nama: string;
  kategori: string;
  kondisi: string;
  jumlah: number;
  catatan: string;
}

// Migrasi lazy — jalankan sekali per proses saat kolom belum ada.
let _materialSchemaReady = false;
async function ensureMaterialColumns(): Promise<void> {
  if (_materialSchemaReady) return;
  const c = getInventoryClient();
  for (const sql of [
    'ALTER TABLE materials ADD COLUMN description TEXT',
    "ALTER TABLE materials ADD COLUMN kondisi TEXT NOT NULL DEFAULT ''"
  ]) {
    try { await c.execute(sql); } catch { /* kolom sudah ada */ }
  }
  _materialSchemaReady = true;
}

let _alatSchemaReady = false;
async function ensureAlatTable(): Promise<void> {
  if (_alatSchemaReady) return;
  const c = getInventoryClient();
  await c.execute(
    `CREATE TABLE IF NOT EXISTS alat_inventaris (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kategori TEXT NOT NULL DEFAULT '',
      kondisi TEXT NOT NULL DEFAULT 'Baru',
      jumlah INTEGER NOT NULL DEFAULT 1,
      catatan TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`
  );
  _alatSchemaReady = true;
}

export async function listMaterials(): Promise<MaterialRow[]> {
  await ensureMaterialColumns();
  const rs = await getInventoryClient().execute(
    'SELECT id, name, category, unit, current_stock, min_stock, description, kondisi FROM materials ORDER BY name'
  );
  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    category: String(r.category),
    unit: String(r.unit),
    currentStock: Number(r.current_stock),
    minStock: Number(r.min_stock),
    description: String(r.description ?? ''),
    kondisi: String(r.kondisi ?? '')
  }));
}

export async function createMaterial(p: {
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  description?: string;
  kondisi?: string;
  by: string;
}): Promise<number> {
  await ensureMaterialColumns();
  const name = p.name.trim();
  const category = p.category.trim();
  const unit = p.unit.trim();
  if (!name || !category || !unit) throw new Error('Nama, kategori, dan satuan wajib diisi.');

  const c = getInventoryClient();
  const dup = await c.execute({ sql: 'SELECT id FROM materials WHERE name = ?', args: [name] });
  if (dup.rows.length > 0) throw new Error(`Bahan "${name}" sudah ada.`);

  const ins = await c.execute({
    sql: `INSERT INTO materials (name, category, unit, current_stock, min_stock, description, kondisi)
          VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [name, category, unit, p.currentStock || 0, p.minStock || 0, p.description || '', p.kondisi || '']
  });
  const id = Number(ins.rows[0].id);
  await logActivity(
    c,
    `Menambahkan bahan baku baru: ${name} (stok awal ${p.currentStock || 0} ${unit}) — oleh ${p.by}`,
    `material_${id}`
  );
  invalidateInventoryCache();
  return id;
}

/**
 * Ubah identitas bahan + stok minimum. Stok berjalan TIDAK diubah di sini —
 * itu urusan koreksi stok, supaya setiap perubahan saldo punya mutasi.
 */
export async function updateMaterial(p: {
  id: number;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  description?: string;
  kondisi?: string;
  by: string;
}): Promise<void> {
  await ensureMaterialColumns();
  const name = p.name.trim();
  const category = p.category.trim();
  const unit = p.unit.trim();
  if (!name || !category || !unit) throw new Error('Nama, kategori, dan satuan wajib diisi.');

  const c = getInventoryClient();
  const cur = await c.execute({ sql: 'SELECT name FROM materials WHERE id = ?', args: [p.id] });
  if (cur.rows.length === 0) throw new Error('Bahan baku tidak ditemukan.');
  const lama = String(cur.rows[0].name);

  if (name !== lama) {
    const dup = await c.execute({ sql: 'SELECT id FROM materials WHERE name = ?', args: [name] });
    if (dup.rows.length > 0) throw new Error(`Bahan "${name}" sudah ada.`);
  }

  await c.execute({
    sql: 'UPDATE materials SET name = ?, category = ?, unit = ?, min_stock = ?, description = ?, kondisi = ? WHERE id = ?',
    args: [name, category, unit, p.minStock || 0, p.description || '', p.kondisi || '', p.id]
  });
  await logActivity(c, `Mengubah detail bahan baku: ${lama} menjadi ${name} — oleh ${p.by}`, `material_${p.id}`);
  invalidateInventoryCache();
}

// ---- Alat Inventaris CRUD ----

export async function listAlat(): Promise<AlatRow[]> {
  await ensureAlatTable();
  const c = getInventoryClient();
  const rs = await c.execute('SELECT id, nama, kategori, kondisi, jumlah, catatan FROM alat_inventaris ORDER BY nama');
  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    nama: String(r.nama),
    kategori: String(r.kategori ?? ''),
    kondisi: String(r.kondisi ?? 'Baru'),
    jumlah: Number(r.jumlah ?? 1),
    catatan: String(r.catatan ?? '')
  }));
}

export async function createAlat(p: { nama: string; kategori?: string; kondisi: string; jumlah: number; catatan?: string; by: string }): Promise<number> {
  await ensureAlatTable();
  const nama = p.nama.trim();
  if (!nama) throw new Error('Nama alat wajib diisi.');
  const c = getInventoryClient();
  const ins = await c.execute({
    sql: `INSERT INTO alat_inventaris (nama, kategori, kondisi, jumlah, catatan) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [nama, p.kategori || '', p.kondisi || 'Baru', p.jumlah || 1, p.catatan || null]
  });
  const id = Number(ins.rows[0].id);
  await logActivity(c, `Tambah alat inventaris: ${nama} — oleh ${p.by}`, `alat_${id}`);
  return id;
}

export async function updateAlat(p: { id: number; nama: string; kategori?: string; kondisi: string; jumlah: number; catatan?: string; by: string }): Promise<void> {
  await ensureAlatTable();
  const nama = p.nama.trim();
  if (!nama) throw new Error('Nama alat wajib diisi.');
  const c = getInventoryClient();
  await c.execute({
    sql: 'UPDATE alat_inventaris SET nama = ?, kategori = ?, kondisi = ?, jumlah = ?, catatan = ?, updated_at = unixepoch() WHERE id = ?',
    args: [nama, p.kategori || '', p.kondisi || 'Baru', p.jumlah || 1, p.catatan || null, p.id]
  });
  await logActivity(c, `Ubah alat inventaris #${p.id}: ${nama} — oleh ${p.by}`, `alat_${p.id}`);
}

const ALAT_SEED = [
  { nama: 'Sarung tangan', jumlah: 2 }, { nama: 'Tespen', jumlah: 1 }, { nama: 'Tang', jumlah: 2 },
  { nama: 'Obeng', jumlah: 2 }, { nama: 'Gunting', jumlah: 1 }, { nama: 'Kunci Inggris', jumlah: 1 },
  { nama: 'Gunting tanaman', jumlah: 1 }, { nama: 'Senter', jumlah: 2 }, { nama: 'Meteran 10m', jumlah: 1 },
  { nama: 'Spidol Snowman', jumlah: 1 }, { nama: 'Penggaris', jumlah: 1 }, { nama: 'Mata Gergaji', jumlah: 1 },
  { nama: 'Palu', jumlah: 1 }, { nama: 'Sapu', jumlah: 2 }, { nama: 'Serok/Pengki', jumlah: 2 },
  { nama: 'Pel', jumlah: 2 }, { nama: 'Serok/Pengki Air', jumlah: 2 }, { nama: 'Troli', jumlah: 2 },
  { nama: 'Kanebo', jumlah: 3 }, { nama: 'Sikat WC', jumlah: 4 }, { nama: 'Sikat Kamar Mandi', jumlah: 4 },
  { nama: 'Kemoceng', jumlah: 1 }, { nama: 'Tangga', jumlah: 2 }, { nama: 'Bor Bosch', jumlah: 1 }
];

/** Seed data alat ke tabel kosong. Dipanggil dari API GET saat tabel baru dibuat. */
export async function seedAlatIfEmpty(): Promise<void> {
  await ensureAlatTable();
  const c = getInventoryClient();
  const count = await c.execute('SELECT COUNT(*) as n FROM alat_inventaris');
  if (Number((count.rows[0] as any).n) > 0) return;
  for (const a of ALAT_SEED) {
    await c.execute({
      sql: `INSERT INTO alat_inventaris (nama, kondisi, jumlah) VALUES (?, 'Baru', ?)`,
      args: [a.nama, a.jumlah]
    });
  }
}

/**
 * Koreksi stok manual: `physicalStock` adalah saldo TUJUAN, bukan selisih.
 * Mutasi CORRECTION dicatat sebesar selisihnya supaya saldo tidak pernah
 * berubah tanpa jejak. Batch sengaja tidak disentuh — koreksi bukan pemakaian,
 * dan menebak batch mana yang salah hitung akan merusak dasar HPP.
 */
export async function postCorrection(p: {
  materialId: number;
  physicalStock: number;
  reason: string;
  by: string;
}): Promise<{ newStock: number; difference: number; transactionId: number | null }> {
  if (!Number.isFinite(p.physicalStock) || p.physicalStock < 0) throw new Error('Stok fisik tidak valid.');
  const reason = p.reason.trim();
  if (!reason) throw new Error('Alasan koreksi wajib diisi.');

  const tx = await getInventoryClient().transaction('write');
  try {
    const mat = await tx.execute({
      sql: 'SELECT name, unit, current_stock FROM materials WHERE id = ?',
      args: [p.materialId]
    });
    if (mat.rows.length === 0) throw new Error('Bahan baku tidak ditemukan.');
    const m = mat.rows[0] as any;
    const lama = Number(m.current_stock);
    const difference = p.physicalStock - lama;

    if (difference === 0) {
      await tx.commit();
      return { newStock: lama, difference: 0, transactionId: null };
    }

    const ins = await tx.execute({
      sql: `INSERT INTO inventory_transactions
              (material_id, user_id, type, quantity, batch_id, unit_price, total_cost, notes, created_at)
            VALUES (?, ?, 'CORRECTION', ?, NULL, NULL, NULL, ?, ?) RETURNING id`,
      args: [p.materialId, SERVICE_USER_ID, difference, `${p.by} — ${reason}`, now()]
    });
    const transactionId = Number(ins.rows[0].id);

    await tx.execute({
      sql: 'UPDATE materials SET current_stock = ? WHERE id = ?',
      args: [p.physicalStock, p.materialId]
    });
    await logActivity(
      tx,
      `Koreksi stok manual: ${m.name} dari ${lama} menjadi ${p.physicalStock} ${m.unit} (alasan: ${reason}) — oleh ${p.by}`,
      `transaction_${transactionId}`
    );

    await tx.commit();
    invalidateInventoryCache();
    return { newStock: p.physicalStock, difference, transactionId };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

/* ------------------------------------------------------------ opname ---- */

export interface OpnameRow {
  id: number;
  period: string;
  status: 'DRAFT' | 'FINALIZED';
}

export interface OpnameDetailRow {
  materialId: number;
  materialName: string;
  materialUnit: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  notes: string;
}

export async function listOpnames(): Promise<OpnameRow[]> {
  const rs = await getInventoryClient().execute(
    'SELECT id, period, status FROM stock_opnames ORDER BY period DESC'
  );
  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    period: String(r.period),
    status: String(r.status) as 'DRAFT' | 'FINALIZED'
  }));
}

export async function getOpname(id: number): Promise<{ opname: OpnameRow; details: OpnameDetailRow[] } | null> {
  const c = getInventoryClient();
  const head = await c.execute({ sql: 'SELECT id, period, status FROM stock_opnames WHERE id = ?', args: [id] });
  if (head.rows.length === 0) return null;
  const h = head.rows[0] as any;

  const det = await c.execute({
    sql: `SELECT d.material_id, m.name, m.unit, d.system_stock, d.physical_stock, d.difference, d.notes
          FROM opname_details d JOIN materials m ON m.id = d.material_id
          WHERE d.opname_id = ? ORDER BY m.name`,
    args: [id]
  });

  return {
    opname: { id: Number(h.id), period: String(h.period), status: String(h.status) as 'DRAFT' | 'FINALIZED' },
    details: det.rows.map((r: any) => ({
      materialId: Number(r.material_id),
      materialName: String(r.name),
      materialUnit: String(r.unit),
      systemStock: Number(r.system_stock),
      physicalStock: Number(r.physical_stock),
      difference: Number(r.difference),
      notes: r.notes == null ? '' : String(r.notes)
    }))
  };
}

/** Buka draf opname periode YYYY-MM: snapshot stok sistem semua bahan saat ini. */
export async function createOpname(period: string, by: string): Promise<number> {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Periode harus format YYYY-MM.');

  const tx = await getInventoryClient().transaction('write');
  try {
    const dup = await tx.execute({ sql: 'SELECT id FROM stock_opnames WHERE period = ?', args: [period] });
    if (dup.rows.length > 0) throw new Error(`Opname periode ${period} sudah dibuat.`);

    const ins = await tx.execute({
      sql: `INSERT INTO stock_opnames (period, status, created_at) VALUES (?, 'DRAFT', ?) RETURNING id`,
      args: [period, now()]
    });
    const id = Number(ins.rows[0].id);

    const mats = await tx.execute({ sql: 'SELECT id, current_stock FROM materials', args: [] });
    for (const m of mats.rows as any[]) {
      await tx.execute({
        sql: `INSERT INTO opname_details (opname_id, material_id, system_stock, physical_stock, difference, notes)
              VALUES (?, ?, ?, ?, 0, '')`,
        args: [id, Number(m.id), Number(m.current_stock), Number(m.current_stock)]
      });
    }

    await logActivity(tx, `Memulai draf opname periode ${period} — oleh ${by}`, `opname_${id}`);
    await tx.commit();
    return id;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

export interface OpnameInput {
  materialId: number;
  physicalStock: number;
  notes: string;
}

/**
 * Simpan hitungan fisik. `finalize` mengunci laporan DAN menyesuaikan stok
 * sistem ke hitungan fisik.
 *
 * BEDA DARI APP LAMA: app lama menimpa `materials.current_stock` tanpa menulis
 * mutasi apa pun, jadi selisih opname hilang dari riwayat dan jumlah transaksi
 * di Dashboard tidak pernah cocok dengan pergerakan saldo. Di sini tiap selisih
 * bukan-nol menjadi satu baris CORRECTION.
 */
export async function saveOpname(p: {
  opnameId: number;
  items: OpnameInput[];
  finalize: boolean;
  by: string;
}): Promise<{ adjusted: number }> {
  const tx = await getInventoryClient().transaction('write');
  try {
    const head = await tx.execute({
      sql: 'SELECT period, status FROM stock_opnames WHERE id = ?',
      args: [p.opnameId]
    });
    if (head.rows.length === 0) throw new Error('Laporan opname tidak ditemukan.');
    const h = head.rows[0] as any;
    if (String(h.status) === 'FINALIZED') throw new Error('Laporan sudah final dan tidak dapat diubah.');

    let adjusted = 0;
    for (const item of p.items) {
      const cur = await tx.execute({
        sql: `SELECT d.system_stock, m.name, m.unit FROM opname_details d
              JOIN materials m ON m.id = d.material_id
              WHERE d.opname_id = ? AND d.material_id = ?`,
        args: [p.opnameId, item.materialId]
      });
      if (cur.rows.length === 0) continue;
      const c0 = cur.rows[0] as any;
      const diff = item.physicalStock - Number(c0.system_stock);

      await tx.execute({
        sql: `UPDATE opname_details SET physical_stock = ?, difference = ?, notes = ?
              WHERE opname_id = ? AND material_id = ?`,
        args: [item.physicalStock, diff, item.notes || null, p.opnameId, item.materialId]
      });

      if (p.finalize && diff !== 0) {
        const ins = await tx.execute({
          sql: `INSERT INTO inventory_transactions
                  (material_id, user_id, type, quantity, batch_id, unit_price, total_cost, notes, created_at)
                VALUES (?, ?, 'CORRECTION', ?, NULL, NULL, NULL, ?, ?) RETURNING id`,
          args: [
            item.materialId,
            SERVICE_USER_ID,
            diff,
            `Opname ${h.period}${item.notes ? ` — ${item.notes}` : ''}`,
            now()
          ]
        });
        await tx.execute({
          sql: 'UPDATE materials SET current_stock = ? WHERE id = ?',
          args: [item.physicalStock, item.materialId]
        });
        await logActivity(
          tx,
          `Opname ${h.period}: ${c0.name} disesuaikan ${diff > 0 ? '+' : ''}${diff} ${c0.unit} — oleh ${p.by}`,
          `transaction_${Number(ins.rows[0].id)}`
        );
        adjusted++;
      }
    }

    if (p.finalize) {
      await tx.execute({ sql: `UPDATE stock_opnames SET status = 'FINALIZED' WHERE id = ?`, args: [p.opnameId] });
      await logActivity(tx, `Memfinalisasi opname periode ${h.period} — oleh ${p.by}`, `opname_${p.opnameId}`);
    } else {
      await logActivity(tx, `Menyimpan draf opname periode ${h.period} — oleh ${p.by}`, `opname_${p.opnameId}`);
    }

    await tx.commit();
    invalidateInventoryCache();
    return { adjusted };
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}

/* ------------------------------------------------- baca untuk halaman ---- */

export interface TransactionRow {
  id: number;
  materialId: number;
  materialName: string;
  materialUnit: string;
  userName: string;
  type: 'PURCHASE' | 'USAGE' | 'CORRECTION';
  quantity: number;
  batchId: number | null;
  unitPrice: number | null;
  totalCost: number | null;
  notes: string | null;
  createdAt: number;
}

export async function listTransactions(f: {
  type?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<TransactionRow[]> {
  const where: string[] = [];
  const args: any[] = [];
  if (f.type) {
    where.push('t.type = ?');
    args.push(f.type);
  }
  if (f.search) {
    where.push('(m.name LIKE ? OR t.notes LIKE ?)');
    args.push(`%${f.search}%`, `%${f.search}%`);
  }
  if (f.from) {
    where.push('t.created_at >= ?');
    args.push(Math.floor(new Date(`${f.from}T00:00:00`).getTime() / 1000));
  }
  if (f.to) {
    where.push('t.created_at <= ?');
    args.push(Math.floor(new Date(`${f.to}T23:59:59`).getTime() / 1000));
  }

  const rs = await getInventoryClient().execute({
    sql: `SELECT t.id, t.material_id, m.name AS material_name, m.unit AS material_unit,
                 COALESCE(u.name, t.user_id) AS user_name, t.type, t.quantity, t.batch_id,
                 t.unit_price, t.total_cost, t.notes, t.created_at
          FROM inventory_transactions t
          JOIN materials m ON m.id = t.material_id
          LEFT JOIN users u ON u.id = t.user_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY t.created_at DESC, t.id DESC`,
    args
  });

  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    materialId: Number(r.material_id),
    materialName: String(r.material_name),
    materialUnit: String(r.material_unit),
    userName: String(r.user_name ?? '-'),
    type: String(r.type) as TransactionRow['type'],
    quantity: Number(r.quantity),
    batchId: r.batch_id == null ? null : Number(r.batch_id),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    totalCost: r.total_cost == null ? null : Number(r.total_cost),
    notes: r.notes == null ? null : String(r.notes),
    createdAt: Number(r.created_at)
  }));
}

export interface BatchRow {
  id: number;
  materialId: number;
  materialName: string;
  materialUnit: string;
  purchaseDate: number;
  quantity: number;
  remainingQty: number;
  totalPrice: number;
  pricePerUnit: number;
  notes: string | null;
}

/** Default hanya batch yang masih bersisa — itu yang bisa dipakai. */
export async function listBatches(materialId?: number, includeEmpty = false): Promise<BatchRow[]> {
  const where: string[] = [];
  const args: any[] = [];
  if (materialId) {
    where.push('b.material_id = ?');
    args.push(materialId);
  }
  if (!includeEmpty) where.push('b.remaining_qty > 0');

  const rs = await getInventoryClient().execute({
    sql: `SELECT b.id, b.material_id, m.name AS material_name, m.unit AS material_unit,
                 b.purchase_date, b.quantity, b.remaining_qty, b.total_price, b.price_per_unit, b.notes
          FROM purchase_batches b
          JOIN materials m ON m.id = b.material_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY b.purchase_date DESC`,
    args
  });

  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    materialId: Number(r.material_id),
    materialName: String(r.material_name),
    materialUnit: String(r.material_unit),
    purchaseDate: Number(r.purchase_date),
    quantity: Number(r.quantity),
    remainingQty: Number(r.remaining_qty),
    totalPrice: Number(r.total_price),
    pricePerUnit: Number(r.price_per_unit),
    notes: r.notes == null ? null : String(r.notes)
  }));
}

export interface LogRow {
  id: number;
  userName: string;
  action: string;
  targetData: string | null;
  createdAt: number;
}

export async function listLogs(limit = 300): Promise<LogRow[]> {
  const rs = await getInventoryClient().execute({
    sql: `SELECT l.id, COALESCE(u.name, l.user_id) AS user_name, l.action, l.target_data, l.created_at
          FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
          ORDER BY l.created_at DESC, l.id DESC LIMIT ?`,
    args: [limit]
  });
  return rs.rows.map((r: any) => ({
    id: Number(r.id),
    userName: String(r.user_name ?? '-'),
    action: String(r.action),
    targetData: r.target_data == null ? null : String(r.target_data),
    createdAt: Number(r.created_at)
  }));
}
