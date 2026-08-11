"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/inventory/Navbar";
import FlowButton from "@/components/inventory/FlowButton";
import OriginSelect from "@/components/inventory/OriginSelect";
import { 
  Sliders, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  User,
  ShieldAlert
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
  quantity: number; // stores the difference
  notes: string | null;
  createdAt: string;
}

export default function CorrectionsPage() {
  const [user, setUser] = useState<InvUser | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [targetStock, setTargetStock] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

      const txsRes = await fetch("/api/inventory/transactions?type=CORRECTION");
      if (txsRes.ok) {
        const data = await txsRes.json();
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Error loading corrections data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (user?.role !== "OWNER") {
      setFormError("Akses ditolak: Hanya OWNER yang dapat melakukan stock opname.");
      return;
    }

    if (!selectedMaterialId) {
      setFormError("Silakan pilih bahan baku");
      return;
    }

    const targetVal = parseFloat(targetStock);
    if (isNaN(targetVal) || targetVal < 0) {
      setFormError("Stok fisik baru tidak boleh kurang dari 0");
      return;
    }

    if (!reason.trim()) {
      setFormError("Alasan koreksi wajib diisi!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: parseInt(selectedMaterialId),
          type: "CORRECTION",
          quantity: targetVal, // Backend handles setting the stock to this targetVal and logging the difference!
          notes: reason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Koreksi stok manual berhasil disimpan!");
        setTargetStock("");
        setReason("");
        loadData();
      } else {
        setFormError(data.error || "Gagal mencatat koreksi");
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
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">Koreksi Jumlah Stok</h1>
          <p className="text-taupe-dark text-sm mt-1 font-medium">
            Sesuaikan jumlah stok secara manual jika ada kehilangan, kerusakan, atau selisih fisik.
          </p>
        </div>

        {user?.role !== "OWNER" ? (
          <div className="glass-panel rounded-3xl p-8 border border-accent/25 text-center max-w-xl mx-auto mt-12">
            <ShieldAlert className="h-12 w-12 text-accent mx-auto mb-4" />
            <h3 className="text-ink font-bold text-lg">Akses Terbatas</h3>
            <p className="text-taupe-dark text-sm mt-2">
              Maaf, Anda login sebagai <span className="font-bold text-emerald-700">{user?.role}</span>. Halaman ini hanya dapat diakses oleh akun dengan tingkat kewenangan <span className="font-bold text-accent">OWNER</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Card */}
            <div className="lg:col-span-1 glass-panel rounded-3xl p-6 border border-sand/70 h-fit relative">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
              
              <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blush/50 text-accent border border-accent-soft/40">
                  <Sliders className="h-4 w-4" />
                </span>
                Koreksi Manual
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
                    options={materials.map((m) => ({
                      value: String(m.id),
                      label: `${m.name} (Sistem: ${m.currentStock} ${m.unit})`
                    }))}
                    className="px-4 py-3 rounded-xl glass-input text-sm bg-white focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                    Stok Fisik Sebenarnya ({selectedMaterial?.unit || ""})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="0"
                    value={targetStock}
                    onChange={(e) => setTargetStock(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                  />
                  {selectedMaterial && targetStock && (
                    <p className="text-[11px] text-taupe-dark mt-1">
                      Selisih:{" "}
                      <span className="font-bold text-ink">
                        {(parseFloat(targetStock) - selectedMaterial.currentStock).toFixed(2)}{" "}
                        {selectedMaterial.unit}
                      </span>{" "}
                      akan disesuaikan di sistem.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Alasan Koreksi (Wajib)</label>
                  <textarea
                    required
                    placeholder="Misal: Pecah saat pemindahan, Susut, Selisih hitung opname, dll."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm min-h-[80px]"
                  />
                </div>

                <FlowButton
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {submitting ? "Menyimpan..." : "Koreksi Stok"}
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
                  Riwayat Koreksi Manual
                </h2>

                {/* Search in History */}
                <div className="relative md:w-64">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-taupe-dark" />
                  <input
                    type="text"
                    placeholder="Cari riwayat koreksi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-2" />
                  <p className="text-taupe-dark text-xs">Memuat riwayat...</p>
                </div>
              ) : filteredTxs.length === 0 ? (
                <div className="py-12 text-center text-taupe-dark">
                  Belum ada koreksi manual tercatat.
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {filteredTxs.map((tx) => {
                    const diff = tx.quantity;
                    return (
                      <div 
                        key={tx.id} 
                        className="p-4 rounded-2xl bg-white/60 border border-sand/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-blush/20 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-ink">{tx.materialName}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              diff >= 0 
                                ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/25" 
                                : "text-accent bg-accent/10 border-red-500/10"
                            }`}>
                              {diff >= 0 ? `+${diff}` : diff} {tx.materialUnit}
                            </span>
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
                              Alasan: {tx.notes}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-taupe-dark border-t md:border-t-0 md:border-l border-sand/70 pt-3 md:pt-0 md:pl-4">
                          <User className="h-3.5 w-3.5" />
                          <span>Oleh: {tx.userName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
