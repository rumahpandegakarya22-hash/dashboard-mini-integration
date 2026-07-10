/**
 * ===== doPost Mini App Kost — tempel di Apps Script file "Invoice Pembayaran SEWA" =====
 *
 * Alur begitu tombol "Konfirmasi & Kirim" ditekan di mini app:
 *   mini app → POST {token, mode:'send', input} ke URL Web App ini
 *   → token diverifikasi → data dicatat sebagai baris baru di sheet "Log Invoice Mini App"
 *   → fungsi generate+kirim invoice yang SUDAH ADA di file ini dipanggil
 *   → hasil (noInv + email tujuan) dibalas ke mini app dan tampil di layar sukses.
 *
 * CARA PASANG (sekali saja):
 * 1. Buka spreadsheet Invoice Pembayaran Sewa → Extensions → Apps Script → tempel seluruh file ini
 *    di file script baru (jangan menimpa fungsi yang sudah ada).
 * 2. Ganti isi fungsi kirimInvoiceDariMiniApp_() di bawah — panggil fungsi generate+kirim milikmu
 *    (fungsi yang selama ini jalan saat tombol/menu manual ditekan). Lihat komentar di dalamnya.
 * 3. Project Settings (ikon gerigi) → Script properties → Add property:
 *    MINIAPP_TOKEN = (samakan persis dengan APPS_SCRIPT_TOKEN di .env.local / Vercel).
 * 4. Deploy → New deployment → Type: Web app → Execute as: Me → Who has access: Anyone → Deploy.
 *    Salin URL /exec → samakan dengan APPS_SCRIPT_INVOICE_SEWA_URL di .env.local / Vercel.
 *    (Kalau kode diubah lagi nanti, buat "New version" pada deployment yang sama agar URL tetap.)
 *
 * Payload `input` yang dikirim mini app (Sewa):
 *   { nama, email, noKamar, tipe, lamaSewa, tglPembayaran (YYYY-MM-DD), periodeAwal (YYYY-MM-DD),
 *     dendaPerUnit, jumlahDenda, pajak, diskon }
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

    // 1) Data masuk ke file spreadsheet ini — append baris log (sheet dibuat otomatis kalau belum ada).
    var logRow = logInvoiceRow_(input, 'DITERIMA');

    // 2) Trigger generate + kirim invoice memakai script yang sudah ada.
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
 * Panggil fungsi generate+kirim invoice yang sudah ada di file ini, dengan data dari mini app.
 * `input` berisi field yang sama dengan form manual: nama, email, noKamar, tipe, lamaSewa,
 * tglPembayaran, periodeAwal, dendaPerUnit, jumlahDenda, pajak, diskon.
 *
 * Contoh — kalau fungsi eksistingmu bernama `prosesInvoice(form)` yang menerima objek form
 * dari sidebar lalu membuat PDF + mengirim email:
 *
 *   function kirimInvoiceDariMiniApp_(input) {
 *     var hasil = prosesInvoice({
 *       noKamar: input.noKamar,
 *       lamaSewa: input.lamaSewa,
 *       tglPembayaran: input.tglPembayaran,
 *       periodeAwal: input.periodeAwal,
 *       dendaPerUnit: input.dendaPerUnit,
 *       jumlahDenda: input.jumlahDenda,
 *       pajak: input.pajak,
 *       diskon: input.diskon
 *     });
 *     return { noInv: hasil.noInv, email: hasil.email };
 *   }
 *
 * Kalau tidak yakin nama fungsinya, kirimkan isi Apps Script file ini ke sesi berikutnya —
 * nanti disesuaikan.
 */
function kirimInvoiceDariMiniApp_(input) {
  throw new Error(
    'kirimInvoiceDariMiniApp_ belum dihubungkan ke fungsi generate invoice di file ini — ' +
      'edit fungsi ini di Apps Script (lihat komentar di atasnya).'
  );
}

/** Append baris log ke sheet "Log Invoice Mini App" (dibuat + diberi header otomatis kalau belum ada). */
function logInvoiceRow_(input, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME_);
    sheet.appendRow([
      'Timestamp', 'No Kamar', 'Nama', 'Email', 'Tipe', 'Lama Sewa (bln)',
      'Tgl Pembayaran', 'Periode Awal', 'Denda/unit', 'Jml Denda', 'Pajak', 'Diskon', 'Status'
    ]);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(), input.noKamar || '', input.nama || '', input.email || '', input.tipe || '',
    input.lamaSewa || '', input.tglPembayaran || '', input.periodeAwal || '',
    input.dendaPerUnit || 0, input.jumlahDenda || 0, input.pajak || 0, input.diskon || 0, status
  ]);
  return sheet.getLastRow();
}

function updateLogStatus_(rowNum, status) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET_NAME_);
  if (sheet && rowNum > 1) sheet.getRange(rowNum, 13).setValue(status);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
