/**
 * ===== doPost Mini App Kost — tempel di Apps Script file "Invoice Pembayaran DP" =====
 *
 * Sama persis dengan versi Sewa, hanya payload-nya lebih ringkas.
 * Ikuti langkah pasang yang sama (lihat invoice-sewa.gs / apps-script/README.md):
 * 1. Tempel file ini di Apps Script file Invoice Pembayaran DP.
 * 2. Hubungkan kirimInvoiceDariMiniApp_() ke fungsi generate+kirim DP yang sudah ada.
 * 3. Script properties: MINIAPP_TOKEN = APPS_SCRIPT_TOKEN.
 * 4. Deploy Web App (Execute as: Me, Access: Anyone) → URL = APPS_SCRIPT_INVOICE_DP_URL.
 *
 * Payload `input` yang dikirim mini app (DP):
 *   { nama, noKamar, tglPembayaran (YYYY-MM-DD), pajak, diskon }
 */

var LOG_SHEET_NAME_ = 'Log Invoice Mini App';

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('MINIAPP_TOKEN');
    if (!expected) return jsonOut_({ success: false, error: 'MINIAPP_TOKEN belum diisi di Script properties.' });
    if (body.token !== expected) return jsonOut_({ success: false, error: 'Token tidak valid.' });
    if (body.mode !== 'send') return jsonOut_({ success: false, error: 'Mode tidak dikenal: ' + body.mode });

    var input = body.input || {};
    var logRow = logInvoiceRow_(input, 'DITERIMA');

    var result = kirimInvoiceDariMiniApp_(input);

    updateLogStatus_(logRow, 'TERKIRIM' + (result && result.noInv ? ' — ' + result.noInv : ''));
    return jsonOut_({
      success: true,
      noInv: (result && result.noInv) || '',
      email: (result && result.email) || input.email || ''
    });
  } catch (err) {
    return jsonOut_({ success: false, error: String((err && err.message) || err) });
  }
}

/**
 * >>> SATU-SATUNYA BAGIAN YANG PERLU KAMU SESUAIKAN <<<
 * Panggil fungsi generate+kirim invoice DP yang sudah ada di file ini.
 * Lihat contoh pola di invoice-sewa.gs.
 */
function kirimInvoiceDariMiniApp_(input) {
  throw new Error(
    'kirimInvoiceDariMiniApp_ belum dihubungkan ke fungsi generate invoice DP di file ini — ' +
      'edit fungsi ini di Apps Script (lihat komentar di atasnya).'
  );
}

/** Append baris log ke sheet "Log Invoice Mini App" (dibuat + diberi header otomatis kalau belum ada). */
function logInvoiceRow_(input, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME_);
    sheet.appendRow(['Timestamp', 'No Kamar', 'Nama', 'Tgl Pembayaran', 'Pajak', 'Diskon', 'Status']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(), input.noKamar || '', input.nama || '', input.tglPembayaran || '',
    input.pajak || 0, input.diskon || 0, status
  ]);
  return sheet.getLastRow();
}

function updateLogStatus_(rowNum, status) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME_);
  if (sheet && rowNum > 1) sheet.getRange(rowNum, 7).setValue(status);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
