// Verifikasi round-trip Google Drive: upload -> download -> cocokkan -> hapus.
// Memakai dotenv (bukan --env-file) supaya GOOGLE_PRIVATE_KEY multi-line ke-parse.
//
// Jalankan:
//   node scripts/uji-drive.mjs [path-ke-env]
// Contoh (pakai kredensial produksi lokal):
//   node scripts/uji-drive.mjs D:/kost-tiga-dara/.env.local
//
// Butuh: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, DRIVE_FOLDER_PEMBAYARAN.
// Folder harus di-share ke service account (atau SA jadi anggota Shared Drive).
import dotenv from "dotenv";
import { google } from "googleapis";
import { Readable } from "node:stream";

const envPath = process.argv[2] || ".env";
dotenv.config({ path: envPath });

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const folder = process.env.DRIVE_FOLDER_PEMBAYARAN;
if (!email || !key || !folder) {
  console.error("Env belum lengkap (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / DRIVE_FOLDER_PEMBAYARAN).");
  process.exit(1);
}

const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/drive"] });
const drive = google.drive({ version: "v3", auth });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

try {
  const buat = await drive.files.create({
    requestBody: { name: `uji-teman-rara-${Date.now()}.png`, parents: [folder] },
    media: { mimeType: "image/png", body: Readable.from(png) },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = buat.data.id;
  console.log("1. Upload OK, fileId:", id);

  const unduh = await drive.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  console.log("2. Download OK,", Buffer.from(unduh.data).equals(png) ? "byte COCOK" : "byte BEDA");

  await drive.files.delete({ fileId: id, supportsAllDrives: true });
  console.log("3. Hapus OK. Round-trip BERHASIL.");
} catch (e) {
  console.error("GAGAL:", e.message);
  console.error("Pastikan folder di-share ke:", email);
  process.exit(1);
}
