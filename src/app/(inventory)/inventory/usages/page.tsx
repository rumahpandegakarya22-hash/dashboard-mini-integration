"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/inventory/Navbar";
import { 
  Activity, 
  Search, 
  Calendar, 
  MinusCircle, 
  User, 
  AlertTriangle, 
  CheckCircle,
  Clock
} from "lucide-react";
import type { InvUser } from "@/components/inventory/Navbar";

interface Material {
  id: number;
  name: string;
  unit: string;
  category: string;
  currentStock: number;
}

interface Transaction {
  id: number;
  materialId: number;
  materialName: string;
  materialUnit: string;
  userId: string;
  userName: string;
  type: string;
  quantity: number;
  unitPrice: number | null;
  totalCost: number | null;
  notes: string | null;
  createdAt: string;
}

interface Batch {
  id: number;
  purchaseDate: string;
  remainingQty: number;
  quantity: number;
  pricePerUnit: number;
  materialUnit: string;
}

const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export default function UsagesPage() {
  const [user, setUser] = useState<InvUser | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const buildHistoryUrl = () => {
    const params = new URLSearchParams({ type: "USAGE" });
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    return `/api/inventory/transactions?${params.toString()}`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch("/api/inventory/profile");
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      const matsRes = await fetch("/api/inventory/materials");
      if (matsRes.ok) {
        const data = await matsRes.json();
        setMaterials(data.materials);
        if (data.materials.length > 0) {
          setSelectedMaterialId(String(data.materials[0].id));
        }
      }

      const txsRes = await fetch(buildHistoryUrl());
      if (txsRes.ok) {
        const data = await txsRes.json();
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Error loading usages data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refetch history when date filters change
  useEffect(() => {
    async function refetchHistory() {
      try {
        const txsRes = await fetch(buildHistoryUrl());
        if (txsRes.ok) {
          const data = await txsRes.json();
          setTransactions(data.transactions);
        }
      } catch (err) {
        console.error("Error filtering history:", err);
      }
    }
    refetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo]);

  const loadBatches = async (materialId: string) => {
    if (!materialId) {
      setBatches([]);
      setSelectedBatchId("");
      return;
    }
    try {
      const res = await fetch(`/api/inventory/batches?materialId=${materialId}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches);
        setSelectedBatchId(data.batches.length > 0 ? String(data.batches[0].id) : "");
      }
    } catch (err) {
      console.error("Error loading batches:", err);
    }
  };

  // Muat batch (sisa > 0) tiap kali bahan berganti
  useEffect(() => {
    loadBatches(selectedMaterialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterialId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!selectedMaterialId) {
      setFormError("Silakan pilih bahan baku");
      return;
    }

    const qtyVal = parseFloat(quantity);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setFormError("Jumlah pemakaian harus lebih dari 0");
      return;
    }

    const selectedMat = materials.find(m => String(m.id) === selectedMaterialId);
    if (selectedMat && selectedMat.currentStock < qtyVal) {
      // Warning for negative stock but we still allow it as per cost-opname requirements
      if (!confirm(`Perhatian: Stok "${selectedMat.name}" saat ini (${selectedMat.currentStock} ${selectedMat.unit}) kurang dari jumlah pemakaian (${qtyVal} ${selectedMat.unit}). Apakah ingin tetap melanjutkan pencatatan?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: parseInt(selectedMaterialId),
          type: "USAGE",
          quantity: qtyVal,
          batchId: selectedBatchId ? parseInt(selectedBatchId) : null,
          notes: notes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Pemakaian berhasil dicatat!");
        setQuantity("");
        setNotes("");
        // Reload history, stock & batch (sisa berkurang)
        loadData();
        loadBatches(selectedMaterialId);
      } else {
        setFormError(data.error || "Gagal mencatat transaksi");
      }
    } catch (err) {
      setFormError("Koneksi gagal");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTxs = transactions.filter(t =>
    t.materialName.toLowerCase().includes(search.toLowerCase()) ||
    (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedMaterial = materials.find(m => String(m.id) === selectedMaterialId);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">Input Pemakaian Bahan</h1>
          <p className="text-taupe-dark text-sm mt-1 font-medium">
            Catat pemakaian bahan baku operasional kost harian untuk mengurangi jumlah stok secara otomatis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Usage Form Card */}
          <div className="lg:col-span-1 glass-panel rounded-3xl p-6 border border-sand/70 h-fit relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-600/30 to-transparent" />
            
            <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
                <Activity className="h-4 w-4" />
              </span>
              Catat Pemakaian
            </h2>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/25 text-accent text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {formError}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Bahan Baku</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-white focus:bg-white"
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id} className="bg-white text-ink">
                      {m.name} (Stok: {m.currentStock} {m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                  Batch Pembelian
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-white focus:bg-white"
                >
                  <option value="" className="bg-white text-ink">Tanpa batch (stok lama / tanpa harga)</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id} className="bg-white text-ink">
                      {new Date(b.purchaseDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      {" · sisa "}{b.remainingQty} {b.materialUnit}
                      {" · "}{rupiah(b.pricePerUnit)}/{b.materialUnit}
                    </option>
                  ))}
                </select>
                {batches.length === 0 && (
                  <p className="text-[11px] text-taupe-dark mt-1.5">Belum ada batch untuk bahan ini. Pemakaian dicatat tanpa harga.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                  Jumlah Pemakaian ({selectedMaterial?.unit || ""})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0.01"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              {/* Biaya pemakaian (live) berdasarkan harga per unit batch */}
              {(() => {
                const q = parseFloat(quantity);
                const batch = batches.find(b => String(b.id) === selectedBatchId);
                if (!batch || isNaN(q) || q <= 0) return null;
                const over = q > batch.remainingQty;
                return (
                  <>
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-xs font-bold text-taupe-dark uppercase tracking-wider">Biaya Pemakaian</span>
                      <span className="text-sm font-extrabold text-emerald-700">{rupiah(q * batch.pricePerUnit)}</span>
                    </div>
                    {over && (
                      <p className="text-[11px] text-accent font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Jumlah melebihi sisa batch ({batch.remainingQty} {batch.materialUnit}). Sisa batch akan jadi 0.
                      </p>
                    )}
                  </>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Keterangan / Penggunaan Untuk</label>
                <textarea
                  placeholder="Misal: Dipakai untuk pembersihan Kamar 104 & 105"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm min-h-[80px]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <MinusCircle className="h-4 w-4" />
                {submitting ? "Menyimpan..." : "Simpan Pemakaian"}
              </button>
            </form>
          </div>

          {/* History List */}
          <div className="lg:col-span-2 glass-panel rounded-3xl p-6 border border-sand/70 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blush/50 text-accent border border-accent-soft/40">
                  <Clock className="h-4 w-4" />
                </span>
                Riwayat Pemakaian
              </h2>

              {/* Search in History */}
              <div className="relative md:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-taupe-dark" />
                <input
                  type="text"
                  placeholder="Cari riwayat pemakaian..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Date range filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <span className="text-[10px] font-bold text-taupe-dark uppercase tracking-wider">Rentang Tanggal:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl glass-input text-xs"
                />
                <span className="text-taupe-dark text-xs">s/d</span>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="px-3 py-2 rounded-xl glass-input text-xs"
                />
                {(filterFrom || filterTo) && (
                  <button
                    onClick={() => { setFilterFrom(""); setFilterTo(""); }}
                    className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-2" />
                <p className="text-taupe-dark text-xs">Memuat riwayat...</p>
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className="py-12 text-center text-taupe-dark">
                Belum ada transaksi pemakaian tercatat.
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {filteredTxs.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="p-4 rounded-2xl bg-white/60 border border-sand/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-blush/20 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-ink">{tx.materialName}</span>
                        {/* Show negative quantities with styling */}
                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-red-500/10">
                          {tx.quantity} {tx.materialUnit}
                        </span>
                        {tx.unitPrice != null && (
                          <span className="text-[10px] font-bold text-taupe-dark bg-sand/60 px-2 py-0.5 rounded-full border border-sand">
                            {rupiah(tx.unitPrice)}/{tx.materialUnit}
                          </span>
                        )}
                        {tx.totalCost != null && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Biaya {rupiah(tx.totalCost)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-taupe-dark mt-1.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {tx.notes && (
                        <p className="text-xs text-stone-700 mt-2 bg-sand/40 px-3 py-1.5 rounded-xl border border-sand/70 w-fit">
                          Note: {tx.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-taupe-dark border-t md:border-t-0 md:border-l border-sand/70 pt-3 md:pt-0 md:pl-4">
                      <User className="h-3.5 w-3.5" />
                      <span>Oleh: {tx.userName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
