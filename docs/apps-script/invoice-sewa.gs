/**
 * ===== doPost Mini App Kost — tempel di Apps Script file "Invoice Pembayaran SEWA" =====
 *
 * Alur begitu tombol "Konfirmasi & Kirim" ditekan di mini app (revisi: Apps Script baca
 * Turso langsung, bukan lagi terima data mentah di payload):
 *   mini app → tulis baris invoice_sewa + payment ke Turso DULU
 *   → POST {token, mode:'send', input:{noInv}} ke URL Web App ini
 *   → token diverifikasi → SELECT baris invoice_sewa itu dari Turso via HTTP API
 *   → copy template Google Docs, isi placeholder, export PDF, kirim email ke penghuni
 *   → hasil (noInv + email tujuan) dibalas ke mini app dan tampil di layar sukses.
 *
 * CARA PASANG (sekali saja):
 * 1. Buka spreadsheet Invoice Pembayaran Sewa → Extensions → Apps Script → tempel seluruh
 *    file ini (jangan menimpa fungsi lama yang masih dipakai menu manual, kalau ada).
 * 2. Buat template invoice di Google Docs, isi placeholder PERSIS seperti daftar di
 *    REPLACEMENTS_ di bawah (mis. {{NAMA}}, {{GRAND_TOTAL}}, dst). Salin ID file-nya dari URL.
 * 3. Project Settings (ikon gerigi) → Script properties → tambah:
 *      MINIAPP_TOKEN        = sama persis dgn APPS_SCRIPT_TOKEN di .env.local/Vercel
 *      TURSO_HTTP_URL       = TURSO_DATABASE_URL tapi skema libsql:// diganti https://
 *                             (mis. libsql://kost-abc.turso.io → https://kost-abc.turso.io)
 *      TURSO_READONLY_TOKEN = token Turso READ-ONLY khusus Apps Script ini —
 *                             BUKAN token read-write yang dipakai mini app.
 *                             Buat dengan: turso db tokens create <nama-db> --read-only
 *      TEMPLATE_DOC_ID_SEWA = ID file Google Docs template invoice Sewa
 *      DRIVE_FOLDER_ID_SEWA = (opsional) ID folder Drive tempat simpan PDF hasil invoice
 * 4. Deploy → New deployment → Type: Web app → Execute as: Me → Who has access: Anyone → Deploy.
 *    Salin URL /exec → samakan dengan APPS_SCRIPT_INVOICE_SEWA_URL di .env.local / Vercel.
 *    (Kalau kode diubah lagi nanti, buat "New version" pada deployment yang sama agar URL tetap.)
 *
 * Payload yang dikirim mini app sekarang HANYA referensi, bukan data lengkap:
 *   { noInv: "INV/11/TDU/07/2026" }
 * Semua field invoice (nama, email, harga, dsb) diambil Apps Script sendiri dari Turso.
 */

var LOG_SHEET_NAME_ = 'Log Invoice Mini App';

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('MINIAPP_TOKEN');
    if (!expected) return jsonOut_({ success: false, error: 'MINIAPP_TOKEN belum diisi di Script properties.' });
    if (body.token !== expected) return jsonOut_({ success: false, error: 'Token tidak valid.' });
    if (body.mode !== 'send') return jsonOut_({ success: false, error: 'Mode tidak dikenal: ' + body.mode });

    var noInv = (body.input && body.input.noInv) || '';
    if (!noInv) return jsonOut_({ success: false, error: 'noInv kosong di payload.' });

    var inv = getInvoiceSewaByNoInv_(noInv);
    if (!inv) return jsonOut_({ success: false, error: 'Invoice ' + noInv + ' tidak ditemukan di Turso (invoice_sewa).' });
    if (!inv.email) return jsonOut_({ success: false, error: 'Email penghuni kosong di invoice_sewa — invoice tidak dikirim.' });

    var logRow = logInvoiceRow_(inv, 'DITERIMA');
    kirimInvoiceSewa_(inv);
    updateLogStatus_(logRow, 'TERKIRIM');

    return jsonOut_({ success: true, noInv: inv.no_inv, email: inv.email });
  } catch (err) {
    return jsonOut_({ success: false, error: String((err && err.message) || err) });
  }
}

/** Ambil satu baris invoice_sewa dari Turso lewat HTTP API (bukan lib client — Apps Script pakai UrlFetchApp). */
function getInvoiceSewaByNoInv_(noInv) {
  var rows = tursoQuery_(
    'SELECT no_inv, nama, email, tanggal_pembayaran, periode_awal, periode_akhir, no_kamar, ' +
      'jumlah_bulan, jumlah_denda, harga_sewa, tambahan_listrik, denda, total_sewa, total_listrik, ' +
      'total_denda, diskon, pajak, subtotal, grand_total, tipe_kamar ' +
      'FROM invoice_sewa WHERE no_inv = ? ORDER BY id DESC LIMIT 1',
    [noInv]
  );
  return rows.length ? rows[0] : null;
}

/** Copy template Docs → isi placeholder → export PDF → kirim email. */
function kirimInvoiceSewa_(inv) {
  var props = PropertiesService.getScriptProperties();
  var templateId = props.getProperty('TEMPLATE_DOC_ID_SEWA');
  if (!templateId) throw new Error('TEMPLATE_DOC_ID_SEWA belum diisi di Script properties.');

  var copyName = 'Invoice Sewa - ' + inv.no_inv;
  var folderId = props.getProperty('DRIVE_FOLDER_ID_SEWA');
  var copyFile = folderId
    ? DriveApp.getFileById(templateId).makeCopy(copyName, DriveApp.getFolderById(folderId))
    : DriveApp.getFileById(templateId).makeCopy(copyName);

  var doc = DocumentApp.openById(copyFile.getId());
  var body = doc.getBody();
  var REPLACEMENTS_ = {
    '{{NO_INV}}': inv.no_inv,
    '{{NAMA}}': inv.nama,
    '{{EMAIL}}': inv.email,
    '{{NO_KAMAR}}': inv.no_kamar,
    '{{TIPE_KAMAR}}': inv.tipe_kamar || '',
    '{{TANGGAL_PEMBAYARAN}}': inv.tanggal_pembayaran || '',
    '{{PERIODE_AWAL}}': inv.periode_awal || '',
    '{{PERIODE_AKHIR}}': inv.periode_akhir || '',
    '{{JUMLAH_BULAN}}': String(inv.jumlah_bulan || ''),
    '{{JUMLAH_DENDA}}': String(inv.jumlah_denda || 0),
    '{{HARGA_SEWA}}': rupiah_(inv.harga_sewa),
    '{{TAMBAHAN_LISTRIK}}': rupiah_(inv.tambahan_listrik),
    '{{DENDA}}': rupiah_(inv.denda),
    '{{TOTAL_SEWA}}': rupiah_(inv.total_sewa),
    '{{TOTAL_LISTRIK}}': rupiah_(inv.total_listrik),
    '{{TOTAL_DENDA}}': rupiah_(inv.total_denda),
    '{{DISKON}}': rupiah_(inv.diskon),
    '{{PAJAK}}': rupiah_(inv.pajak),
    '{{SUBTOTAL}}': rupiah_(inv.subtotal),
    '{{GRAND_TOTAL}}': rupiah_(inv.grand_total)
  };
  Object.keys(REPLACEMENTS_).forEach(function (key) {
    body.replaceText(key.replace(/[{}]/g, '\\$&'), REPLACEMENTS_[key]);
  });
  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(copyFile.getId()).getAs('application/pdf').setName(copyName + '.pdf');
  MailApp.sendEmail({
    to: inv.email,
    subject: 'Invoice Sewa Kost Tiga Dara — ' + inv.no_inv,
    body: 'Halo ' + inv.nama + ',\n\nBerikut invoice pembayaran sewa kamar ' + inv.no_kamar + '.\n\nTerima kasih.',
    attachments: [pdfBlob]
  });

  // Kalau tidak diarahkan ke folder Drive khusus (DRIVE_FOLDER_ID_SEWA kosong), file Docs hasil
  // copy tidak perlu disimpan permanen — cukup PDF-nya yang sudah terlampir di email.
  if (!props.getProperty('DRIVE_FOLDER_ID_SEWA')) DriveApp.getFileById(copyFile.getId()).setTrashed(true);
}

/** Format Rupiah sederhana tanpa simbol, mis. 850000 -> "850.000". */
function rupiah_(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

/**
 * Query Turso via HTTP API (v2 pipeline) — dipakai dari Apps Script krn tidak ada libSQL
 * client utk Apps Script, jadi manggil endpoint HTTP-nya langsung pakai UrlFetchApp.
 * Token WAJIB read-only (TURSO_READONLY_TOKEN), Apps Script ini tidak pernah menulis ke Turso.
 */
function tursoQuery_(sql, args) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('TURSO_HTTP_URL');
  var token = props.getProperty('TURSO_READONLY_TOKEN');
  if (!url) throw new Error('TURSO_HTTP_URL belum diisi di Script properties.');
  if (!token) throw new Error('TURSO_READONLY_TOKEN belum diisi di Script properties.');

  var tursoArgs = (args || []).map(function (v) {
    if (v === null || v === undefined) return { type: 'null' };
    if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
    return { type: 'text', value: String(v) };
  });

  var resp = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/v2/pipeline', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql: sql, args: tursoArgs } }, { type: 'close' }]
    })
  });
  if (resp.getResponseCode() >= 300) throw new Error('Turso HTTP API error ' + resp.getResponseCode() + ': ' + resp.getContentText());

  var json = JSON.parse(resp.getContentText());
  var execResult = json.results && json.results[0];
  if (!execResult || execResult.type !== 'ok') {
    throw new Error('Turso query gagal: ' + (execResult && execResult.error && execResult.error.message));
  }
  var result = execResult.response.result;
  var cols = result.cols.map(function (c) { return c.name; });
  return result.rows.map(function (row) {
    var obj = {};
    cols.forEach(function (name, i) {
      var cell = row[i];
      obj[name] = cell.type === 'null' ? null : cell.type === 'integer' || cell.type === 'float' ? Number(cell.value) : cell.value;
    });
    return obj;
  });
}

/** Append baris log ke sheet "Log Invoice Mini App" (dibuat + diberi header otomatis kalau belum ada). */
function logInvoiceRow_(inv, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME_);
    sheet.appendRow(['Timestamp', 'No Invoice', 'No Kamar', 'Nama', 'Email', 'Grand Total', 'Status']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), inv.no_inv, inv.no_kamar, inv.nama, inv.email, inv.grand_total, status]);
  return sheet.getLastRow();
}

function updateLogStatus_(rowNum, status) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME_);
  if (sheet && rowNum > 1) sheet.getRange(rowNum, 7).setValue(status);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
