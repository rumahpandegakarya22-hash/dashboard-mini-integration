"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "@/components/inventory/Navbar";
import { 
  ClipboardList, 
  Plus, 
  Calendar, 
  Printer, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  ArrowLeft,
  Save,
  CheckCircle2,
  FileText,
  X
} from "lucide-react";
import type { InvUser } from "@/components/inventory/Navbar";

interface Opname {
  id: number;
  period: string;
  status: "DRAFT" | "FINALIZED";
  verifiedById: string | null;
  verifierName: string;
  createdAt: string;
}

interface OpnameDetail {
  id: number;
  materialId: number;
  materialName: string;
  materialUnit: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  notes: string | null;
}

export default function OpnamePage() {
  const [user, setUser] = useState<InvUser | null>(null);
  const [opnames, setOpnames] = useState<Opname[]>([]);
  const [selectedOpname, setSelectedOpname] = useState<Opname | null>(null);
  const [details, setDetails] = useState<OpnameDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadOpnames = async () => {
    try {
      setLoading(true);
      const userRes = await fetch("/api/inventory/profile");
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      const res = await fetch("/api/inventory/opname");
      if (res.ok) {
        const data = await res.json();
        setOpnames(data.opnames);
      }
    } catch (err) {
      console.error("Error loading opnames:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpnames();
    // Default newPeriod to current month (YYYY-MM)
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    setNewPeriod(`${yyyy}-${mm}`);
  }, []);

  const handleSelectOpname = async (opname: Opname) => {
    try {
      setDetailsLoading(true);
      const res = await fetch(`/api/inventory/opname?id=${opname.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOpname(data.opname);
        setDetails(data.details);
      }
    } catch (err) {
      console.error("Error loading opname details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!newPeriod) {
      setFormError("Periode YYYY-MM wajib diisi");
      return;
    }

    try {
      const res = await fetch("/api/inventory/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          period: newPeriod,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Laporan opname berhasil dibuat!");
        setShowCreateModal(false);
        loadOpnames();
        // Load details for the new opname
        handleSelectOpname({
          id: data.id,
          period: newPeriod,
          status: "DRAFT",
          verifiedById: null,
          verifierName: "-",
          createdAt: new Date().toISOString()
        });
      } else {
        setFormError(data.error || "Gagal membuat opname");
      }
    } catch (err) {
      setFormError("Koneksi gagal");
    }
  };

  const handlePhysicalStockChange = (materialId: number, value: string) => {
    const val = parseFloat(value) || 0;
    setDetails(prev => prev.map(item => {
      if (item.materialId === materialId) {
        const diff = val - item.systemStock;
        return {
          ...item,
          physicalStock: val,
          difference: diff
        };
      }
      return item;
    }));
  };

  const handleNotesChange = (materialId: number, value: string) => {
    setDetails(prev => prev.map(item => {
      if (item.materialId === materialId) {
        return {
          ...item,
          notes: value
        };
      }
      return item;
    }));
  };

  const handleSaveDraft = async () => {
    if (!selectedOpname) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_DRAFT",
          opnameId: selectedOpname.id,
          items: details,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Draf opname berhasil disimpan ke database.");
      } else {
        alert(data.error || "Gagal menyimpan draf");
      }
    } catch (err) {
      alert("Koneksi gagal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedOpname) return;
    if (!confirm("Apakah Anda yakin ingin memfinalisasi laporan opname ini? Setelah difinalisasi, jumlah stok bahan baku di sistem akan disesuaikan otomatis dengan stok fisik dan data akan disinkronisasikan ke Web App Keuangan!")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "FINALIZE",
          opnameId: selectedOpname.id,
          items: details,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Sukses! Laporan telah difinalisasi.\nStatus Sinkronisasi Keuangan: ${data.syncStatus}\nAPI Endpoint: ${data.syncedTo}`);
        // Reload details
        handleSelectOpname(selectedOpname);
        loadOpnames();
      } else {
        alert(data.error || "Gagal memfinalisasi");
      }
    } catch (err) {
      alert("Koneksi gagal");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = () => {
    if (!selectedOpname) return;

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const totalSystem = details.reduce((sum, d) => sum + d.systemStock, 0);
    const totalPhysical = details.reduce((sum, d) => sum + d.physicalStock, 0);
    const totalDiff = details.reduce((sum, d) => sum + d.difference, 0);

    const rows = details
      .map(
        (d) => `
        <tr>
          <td>${escapeHtml(d.materialName)}</td>
          <td>${escapeHtml(d.materialUnit)}</td>
          <td style="text-align:right">${d.systemStock}</td>
          <td style="text-align:right">${d.physicalStock}</td>
          <td style="text-align:right; color:${d.difference < 0 ? "#b91c1c" : d.difference > 0 ? "#047857" : "#000"}">${d.difference > 0 ? "+" : ""}${d.difference}</td>
          <td>${escapeHtml(d.notes || "-")}</td>
        </tr>`
      )
      .join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table border="1">
          <tr><td colspan="6" style="font-weight:bold; font-size:16px">Laporan Stock Opname</td></tr>
          <tr><td colspan="6">Periode: ${escapeHtml(selectedOpname.period)}</td></tr>
          <tr><td colspan="6">Status: ${selectedOpname.status === "FINALIZED" ? "SELESAI (Final)" : "DRAF"}</td></tr>
          <tr><td colspan="6">Tanggal Unduh: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
          <tr><td colspan="6">Verifikator: ${escapeHtml(selectedOpname.verifierName || "-")}</td></tr>
          <tr><td colspan="6"></td></tr>
          <tr style="font-weight:bold; background:#eef">
            <td>Nama Bahan</td>
            <td>Satuan</td>
            <td>Stok Tercatat</td>
            <td>Stok Fisik</td>
            <td>Selisih</td>
            <td>Keterangan</td>
          </tr>
          ${rows}
          <tr style="font-weight:bold; background:#eef">
            <td colspan="2">TOTAL (${details.length} bahan)</td>
            <td style="text-align:right">${totalSystem}</td>
            <td style="text-align:right">${totalPhysical}</td>
            <td style="text-align:right">${totalDiff > 0 ? "+" : ""}${totalDiff}</td>
            <td></td>
          </tr>
        </table>
      </body>
      </html>`;

    const blob = new Blob(["﻿" + html], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan-Opname-${selectedOpname.period}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="no-print w-full">
        <Navbar />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Main Title - Hidden in print view unless formatted */}
        {!selectedOpname && (
          <div className="no-print mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-ink tracking-tight">Stock Opname Akhir Bulan</h1>
              <p className="text-taupe-dark text-sm mt-1 font-medium">
                Kelola laporan stok opname bulanan, hitung selisih fisik, dan sinkronkan dengan laporan keuangan.
              </p>
            </div>
            <button
              onClick={() => {
                setFormError("");
                setSuccessMsg("");
                setShowCreateModal(true);
              }}
              className="py-3 px-5 rounded-2xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all duration-300 shadow-lg flex items-center gap-2 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Mulai Opname Baru
            </button>
          </div>
        )}

        {/* View 1: Opname List */}
        {!selectedOpname && (
          <div className="no-print glass-panel rounded-3xl p-6 border border-sand/70">
            <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-accent" />
              Daftar Periode Opname
            </h2>

            {loading ? (
              <div className="py-24 text-center">
                <div className="w-10 h-10 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-4" />
                <p className="text-taupe-dark font-medium">Memuat data opname...</p>
              </div>
            ) : opnames.length === 0 ? (
              <div className="py-16 text-center text-taupe-dark">
                Belum ada laporan opname dibuat. Silakan klik tombol "Mulai Opname Baru".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-sand text-xs font-bold text-taupe-dark uppercase tracking-wider">
                      <th className="py-3 px-4">Periode</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Tanggal Dibuat</th>
                      <th className="py-3 px-4">Diverifikasi Oleh</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand/70 text-sm">
                    {opnames.map((opname) => (
                      <tr 
                        key={opname.id}
                        className="hover:bg-blush/15 transition-colors"
                      >
                        <td className="py-4 px-4 font-bold text-ink flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-accent" />
                          {opname.period}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            opname.status === "FINALIZED"
                              ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/25"
                              : "text-amber-700 bg-amber-500/10 border-amber-500/30"
                          }`}>
                            {opname.status === "FINALIZED" ? "SELESAI (Final)" : "DRAF"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-stone-700">
                          {new Date(opname.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </td>
                        <td className="py-4 px-4 text-stone-700">{opname.verifierName}</td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleSelectOpname(opname)}
                            className="py-1.5 px-3 rounded-lg bg-sand/40 hover:bg-blush/40 text-ink font-semibold text-xs border border-sand/70 transition-all"
                          >
                            Buka Laporan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View 2: Opname Detail (Print Friendly) */}
        {selectedOpname && (
          <div className="glass-panel rounded-3xl p-6 border border-sand/70 flex flex-col relative overflow-hidden print:p-0 print:border-none print:bg-white print:text-black">
            
            {/* Header controls - Hidden in Print */}
            <div className="no-print flex justify-between items-center mb-6 border-b border-sand/70 pb-4">
              <button
                onClick={() => setSelectedOpname(null)}
                className="flex items-center gap-2 text-taupe-dark hover:text-ink transition-colors text-sm font-semibold"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="py-2 px-4 rounded-xl glass-button text-xs font-bold text-stone-700 flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Cetak PDF
                </button>

                <button
                  onClick={handleDownloadExcel}
                  className="py-2 px-4 rounded-xl glass-button text-xs font-bold text-stone-700 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Unduh Excel
                </button>

                {selectedOpname.status === "DRAFT" && (
                  <>
                    <button
                      onClick={handleSaveDraft}
                      className="py-2 px-4 rounded-xl glass-button text-xs font-bold text-stone-700 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Simpan Draf
                    </button>
                    <button
                      onClick={handleFinalize}
                      disabled={submitting}
                      className="py-2 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {submitting ? "Memproses..." : "Finalisasi & Sync"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Print Header: Shows only when printing or inside preview */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-ink print:text-black tracking-tight">
                  Laporan Stock Opname
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-700 print:text-slate-700">
                  <span className="font-semibold text-ink print:text-black">
                    Periode: {selectedOpname.period}
                  </span>
                  <span className="text-taupe print:hidden">|</span>
                  <span>Dibuat: {new Date(selectedOpname.createdAt).toLocaleDateString("id-ID")}</span>
                  <span className="text-taupe print:hidden">|</span>
                  <span>Verifikator: {selectedOpname.verifierName}</span>
                </div>
              </div>

              <div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold border print:border-black/20 ${
                  selectedOpname.status === "FINALIZED"
                    ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/25 print:text-emerald-800 print:bg-emerald-50"
                    : "text-amber-700 bg-amber-500/10 border-amber-500/30 print:text-amber-800 print:bg-amber-50"
                }`}>
                  {selectedOpname.status === "FINALIZED" ? "SELESAI (FINALIZED)" : "DRAFT OPNAME"}
                </span>
              </div>
            </div>

            {/* Opname details table */}
            {detailsLoading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-2" />
                <p className="text-taupe-dark text-xs">Memuat detail opname...</p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse print:text-black">
                  <thead>
                    <tr className="border-b border-sand print:border-black/20 text-xs font-bold text-taupe-dark print:text-taupe uppercase tracking-wider">
                      <th className="py-3 px-4">Nama Bahan</th>
                      <th className="py-3 px-4 text-right">Stok Sistem</th>
                      <th className="py-3 px-4 text-right w-36">Stok Fisik</th>
                      <th className="py-3 px-4 text-right">Selisih</th>
                      <th className="py-3 px-4 pl-8">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand/70 print:divide-black/10 text-sm">
                    {details.map((item) => {
                      const isDraft = selectedOpname.status === "DRAFT";
                      const diff = item.difference;
                      return (
                        <tr key={item.id} className="hover:bg-blush/10 print:hover:bg-transparent">
                          <td className="py-3.5 px-4 font-bold text-ink print:text-black">
                            {item.materialName}
                          </td>
                          <td className="py-3.5 px-4 text-right text-stone-700 print:text-black">
                            {item.systemStock} {item.materialUnit}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isDraft ? (
                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={item.physicalStock}
                                  onChange={(e) => handlePhysicalStockChange(item.materialId, e.target.value)}
                                  className="w-20 px-2 py-1 rounded glass-input text-right text-xs"
                                />
                                <span className="text-xs text-taupe-dark">{item.materialUnit}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-ink print:text-black">
                                {item.physicalStock} {item.materialUnit}
                              </span>
                            )}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-extrabold ${
                            diff > 0 
                              ? "text-emerald-700 print:text-emerald-700" 
                              : diff < 0 
                                ? "text-accent print:text-red-700" 
                                : "text-stone-700 print:text-black"
                          }`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                          <td className="py-3.5 px-4 pl-8">
                            {isDraft ? (
                              <input
                                type="text"
                                placeholder="Tambah catatan..."
                                value={item.notes || ""}
                                onChange={(e) => handleNotesChange(item.materialId, e.target.value)}
                                className="w-full px-3 py-1 rounded glass-input text-xs"
                              />
                            ) : (
                              <span className="text-xs text-taupe-dark print:text-slate-700">
                                {item.notes || "-"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Print Footer sign area */}
            <div className="hidden print:flex justify-end gap-16 mt-20 text-center">
              <div className="flex flex-col">
                <span className="text-xs text-taupe-dark">Staf Penanggung Jawab</span>
                <div className="h-16" />
                <span className="text-xs font-bold border-t border-black pt-1 w-40">
                  ( ____________________ )
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-taupe-dark">Owner Verifikator</span>
                <div className="h-16" />
                <span className="text-xs font-bold border-t border-black pt-1 w-40">
                  {selectedOpname.verifierName}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* Modal: Create Opname Period */}
        <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="w-full max-w-md glass-panel-dark rounded-3xl p-6 border border-sand relative"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-accent" />
                  Mulai Opname Periode Baru
                </h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-taupe-dark hover:text-ink hover:bg-blush/30 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/25 text-accent text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateOpname} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                    Bulan & Tahun Opname (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    required
                    value={newPeriod}
                    onChange={(e) => setNewPeriod(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                  />
                  <p className="text-[10px] text-taupe-dark mt-1">
                    *Sistem akan menarik data stok saat ini dari seluruh bahan baku master untuk draf awal opname.
                  </p>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl glass-button text-xs font-bold text-stone-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-xs"
                  >
                    Buat Draf Opname
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Dynamic print stylesheet */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
