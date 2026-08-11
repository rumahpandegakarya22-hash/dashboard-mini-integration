"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/inventory/Navbar";
import FlowButton from "@/components/inventory/FlowButton";
import OriginSelect from "@/components/inventory/OriginSelect";
import { GlassDateField } from "@/components/ui/GlassCalendar";
import { 
  ShoppingCart, 
  Search, 
  Calendar, 
  PlusCircle, 
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

const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export default function PurchasesPage() {
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
  const [quantity, setQuantity] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalPrice, setTotalPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const buildHistoryUrl = () => {
    const params = new URLSearchParams({ type: "PURCHASE" });
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
      console.error("Error loading purchases data:", err);
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
      setFormError("Jumlah belanja harus lebih dari 0");
      return;
    }

    const priceVal = parseFloat(totalPrice);
    if (isNaN(priceVal) || priceVal < 0) {
      setFormError("Harga total belanja tidak valid");
      return;
    }

    if (!purchaseDate) {
      setFormError("Tanggal pembelian wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: parseInt(selectedMaterialId),
          type: "PURCHASE",
          quantity: qtyVal,
          purchaseDate,
          totalPrice: priceVal,
          notes: notes || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Pembelian berhasil dicatat!");
        setQuantity("");
        setTotalPrice("");
        setNotes("");
        // Reload history
        const txsRes = await fetch(buildHistoryUrl());
        if (txsRes.ok) {
          const data = await txsRes.json();
          setTransactions(data.transactions);
        }
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
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">Input Pembelian Bahan</h1>
          <p className="text-taupe-dark text-sm mt-1 font-medium">
            Catat setiap pembelanjaan barang operasional kost.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Purchase Form Card */}
          <div className="lg:col-span-1 glass-panel rounded-3xl p-6 border border-sand/70 h-fit relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
            
            <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
                <ShoppingCart className="h-4 w-4" />
              </span>
              Catat Belanja
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
                <OriginSelect
                  ariaLabel="Bahan Baku"
                  value={selectedMaterialId}
                  onChange={setSelectedMaterialId}
                  options={materials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.unit})` }))}
                  className="px-4 py-3 rounded-xl glass-input text-sm bg-white focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                  Jumlah Belanja ({selectedMaterial?.unit || ""})
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

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Tanggal Pembelian</label>
                <GlassDateField
                  value={purchaseDate}
                  onChange={setPurchaseDate}
                  placeholder="Tanggal pembelian"
                  buttonClassName="flex w-full items-center justify-between gap-2 px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Harga Total Belanja (Rp)</label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0"
                  placeholder="0"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                />
              </div>

              {/* Harga per unit (live) */}
              {(() => {
                const q = parseFloat(quantity);
                const p = parseFloat(totalPrice);
                if (!isNaN(q) && q > 0 && !isNaN(p) && p >= 0) {
                  return (
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-blush/40 border border-accent-soft/40">
                      <span className="text-xs font-bold text-taupe-dark uppercase tracking-wider">Harga per {selectedMaterial?.unit || "unit"}</span>
                      <span className="text-sm font-extrabold text-accent">{rupiah(p / q)}</span>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Keterangan / Catatan</label>
                <textarea
                  placeholder="Misal: Beli di Supermarket Indogrosir"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm min-h-[80px]"
                />
              </div>

              <FlowButton
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4" />
                {submitting ? "Menyimpan..." : "Simpan Transaksi"}
              </FlowButton>
            </form>
          </div>

          {/* History List */}
          <div className="lg:col-span-2 glass-panel rounded-3xl p-6 border border-sand/70 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blush/50 text-accent border border-accent-soft/40">
                  <Clock className="h-4 w-4" />
                </span>
                Riwayat Pembelian
              </h2>

              {/* Search in History */}
              <div className="relative md:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-taupe-dark" />
                <input
                  type="text"
                  placeholder="Cari riwayat belanja..."
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
                <GlassDateField
                  value={filterFrom}
                  onChange={setFilterFrom}
                  placeholder="Dari"
                  buttonClassName="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-xl glass-input text-xs"
                />
                <span className="text-taupe-dark text-xs">s/d</span>
                <GlassDateField
                  value={filterTo}
                  onChange={setFilterTo}
                  placeholder="Sampai"
                  buttonClassName="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-xl glass-input text-xs"
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
                Belum ada transaksi pembelian tercatat.
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
                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                          +{tx.quantity} {tx.materialUnit}
                        </span>
                        {tx.unitPrice != null && (
                          <span className="text-[10px] font-bold text-taupe-dark bg-sand/60 px-2 py-0.5 rounded-full border border-sand">
                            {rupiah(tx.unitPrice)}/{tx.materialUnit}
                          </span>
                        )}
                        {tx.totalCost != null && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Total {rupiah(tx.totalCost)}
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
