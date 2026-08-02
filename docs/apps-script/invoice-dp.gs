/**
 * ===== doPost Mini App Kost — tempel di Apps Script file "Invoice Pembayaran DP" =====
 *
 * Sama persis dengan versi Sewa (lihat invoice-sewa.gs untuk penjelasan lengkap alur &
 * langkah pasang) — bedanya cuma baca tabel `invoice_dp` dan template Docs-nya sendiri.
 *
 * Script properties yang dibutuhkan:
 *   MINIAPP_TOKEN, TURSO_HTTP_URL, TURSO_READONLY_TOKEN (SAMA dgn invoice-sewa.gs,
 *   boleh dipakai bersama kalau file ini ditempel di project Apps Script yang sama),
 *   TEMPLATE_DOC_ID_DP, DRIVE_FOLDER_ID_DP (opsional).
 *
 * Payload dari mini app: { noInv: "..." }
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

    var inv = getInvoiceDpByNoInv_(noInv);
    if (!inv) return jsonOut_({ success: false, error: 'Invoice ' + noInv + ' tidak ditemukan di Turso (invoice_dp).' });
    if (!inv.email) return jsonOut_({ success: false, error: 'Email penghuni kosong di invoice_dp — invoice tidak dikirim.' });

    var logRow = logInvoiceRow_(inv, 'DITERIMA');
    kirimInvoiceDp_(inv);
    updateLogStatus_(logRow, 'TERKIRIM');

    return jsonOut_({ success: true, noInv: inv.no_inv, email: inv.email });
  } catch (err) {
    return jsonOut_({ success: false, error: String((err && err.message) || err) });
  }
}

function getInvoiceDpByNoInv_(noInv) {
  var rows = tursoQuery_(
    'SELECT no_inv, nama, email, tanggal_pembayaran, no_kamar, tipe_kamar, jumlah, ' +
      'harga_kamar, subtotal, pajak, diskon, grand_total ' +
      'FROM invoice_dp WHERE no_inv = ? ORDER BY id DESC LIMIT 1',
    [noInv]
  );
  return rows.length ? rows[0] : null;
}

function kirimInvoiceDp_(inv) {
  var props = PropertiesService.getScriptProperties();
  var templateId = props.getProperty('TEMPLATE_DOC_ID_DP');
  if (!templateId) throw new Error('TEMPLATE_DOC_ID_DP belum diisi di Script properties.');

  var copyName = 'Invoice DP - ' + inv.no_inv;
  var folderId = props.getProperty('DRIVE_FOLDER_ID_DP');
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
    '{{JUMLAH}}': String(inv.jumlah || 1),
    '{{HARGA_KAMAR}}': rupiah_(inv.harga_kamar),
    '{{SUBTOTAL}}': rupiah_(inv.subtotal),
    '{{PAJAK}}': rupiah_(inv.pajak),
    '{{DISKON}}': rupiah_(inv.diskon),
    '{{GRAND_TOTAL}}': rupiah_(inv.grand_total)
  };
  Object.keys(REPLACEMENTS_).forEach(function (key) {
    body.replaceText(key.replace(/[{}]/g, '\\$&'), REPLACEMENTS_[key]);
  });
  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(copyFile.getId()).getAs('application/pdf').setName(copyName + '.pdf');
  MailApp.sendEmail({
    to: inv.email,
    subject: 'Invoice DP Kost Tiga Dara — ' + inv.no_inv,
    body: 'Halo ' + inv.nama + ',\n\nBerikut invoice DP kamar ' + inv.no_kamar + '.\n\nTerima kasih.',
    attachments: [pdfBlob]
  });

  if (!props.getProperty('DRIVE_FOLDER_ID_DP')) DriveApp.getFileById(copyFile.getId()).setTrashed(true);
}

function rupiah_(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

/** SAMA PERSIS dengan invoice-sewa.gs — kalau kedua file ditempel di project Apps Script
 *  yang sama, fungsi ini cukup ada sekali (hapus duplikatnya di salah satu file). */
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
