"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "@/components/inventory/Navbar";
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  X, 
  AlertTriangle, 
  CheckCircle,
  FileEdit
} from "lucide-react";
import type { InvUser } from "@/components/inventory/Navbar";

interface Material {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
}

export default function MaterialsPage() {
  const [user, setUser] = useState<InvUser | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  // Form States
  const [formData, setFormData] = useState({
    name: "",
    category: "Kebersihan",
    unit: "pcs",
    currentStock: "0",
    minStock: "5",
  });
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const categories = ["Kebersihan", "Dapur & Konsumsi", "Perawatan Kamar", "Fasilitas Umum", "Lainnya"];
  const units = ["pcs", "botol", "kg", "liter", "pack", "roll", "dus"];

  const loadData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch("/api/inventory/profile");
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      const res = await fetch("/api/inventory/materials");
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials);
      }
    } catch (err) {
      console.error("Error loading materials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      category: "Kebersihan",
      unit: "pcs",
      currentStock: "0",
      minStock: "5",
    });
    setFormError("");
    setSuccessMsg("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (material: Material) => {
    setSelectedMaterial(material);
    setFormData({
      name: material.name,
      category: material.category,
      unit: material.unit,
      currentStock: String(material.currentStock),
      minStock: String(material.minStock),
    });
    setFormError("");
    setSuccessMsg("");
    setShowEditModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/inventory/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          currentStock: parseFloat(formData.currentStock),
          minStock: parseFloat(formData.minStock),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Bahan baku berhasil ditambahkan!");
        setTimeout(() => {
          setShowAddModal(false);
          loadData();
        }, 1500);
      } else {
        setFormError(data.error || "Gagal menambahkan bahan");
      }
    } catch (err) {
      setFormError("Koneksi gagal");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!selectedMaterial) return;

    try {
      const res = await fetch("/api/inventory/materials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedMaterial.id,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          minStock: parseFloat(formData.minStock),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Detail bahan baku berhasil diperbarui!");
        setTimeout(() => {
          setShowEditModal(false);
          loadData();
        }, 1500);
      } else {
        setFormError(data.error || "Gagal mengubah bahan");
      }
    } catch (err) {
      setFormError("Koneksi gagal");
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  const isOwner = user?.role === "OWNER";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header section with Search and Add buttons */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight">Daftar Bahan Baku</h1>
            <p className="text-taupe-dark text-sm mt-1 font-medium">
              Kelola master data bahan baku dan pantau stok fisik secara real-time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-taupe-dark" />
              <input
                type="text"
                placeholder="Cari nama atau kategori..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-3 rounded-2xl glass-input text-sm"
              />
            </div>

            {/* Add Button (Owner only) */}
            {isOwner && (
              <button
                onClick={handleOpenAdd}
                className="py-3 px-5 rounded-2xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all duration-300 shadow-lg flex items-center gap-2 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Tambah Bahan
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-4" />
            <p className="text-taupe-dark font-medium">Memuat bahan baku...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center border border-sand/70">
            <Package className="h-12 w-12 text-taupe-dark mx-auto mb-4" />
            <h3 className="text-ink font-bold text-lg">Bahan Baku Tidak Ditemukan</h3>
            <p className="text-taupe-dark text-sm mt-1">Coba cari dengan kata kunci lain atau tambahkan bahan baru.</p>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map((item) => {
              const isLow = item.currentStock <= item.minStock;
              return (
                <div 
                  key={item.id} 
                  className={`glass-card rounded-3xl p-6 border relative overflow-hidden flex flex-col justify-between ${
                    isLow 
                      ? "border-accent/25 bg-accent/[0.02]" 
                      : "border-sand/70"
                  }`}
                >
                  <div>
                    {/* Category Tag & Edit Button */}
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                        {item.category}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-2 rounded-lg text-taupe-dark hover:text-ink hover:bg-blush/30 border border-transparent hover:border-sand/70 transition-all"
                          title="Edit Detail"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Material Name */}
                    <h3 className="text-lg font-bold text-ink tracking-wide mb-2 truncate">
                      {item.name}
                    </h3>
                  </div>

                  {/* Stock status indicator */}
                  <div className="mt-6 pt-4 border-t border-sand/70 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-taupe-dark font-medium">Stok Terkini</span>
                      <span className={`text-xl font-extrabold mt-1 ${isLow ? "text-accent" : "text-ink"}`}>
                        {item.currentStock} <span className="text-sm font-semibold text-taupe-dark">{item.unit}</span>
                      </span>
                    </div>

                    <div className="flex flex-col text-right">
                      <span className="text-xs text-taupe-dark font-medium">Batas Min</span>
                      <span className="text-sm font-bold text-stone-700 mt-1.5">
                        {item.minStock} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Low Stock Warning Banner inside card */}
                  {isLow && (
                    <div className="mt-4 p-2.5 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-2 text-accent text-xs">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>Stok menipis, segera restock!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add Material — AnimatePresence supaya exit sempat diputar,
            bukan langsung unmount seperti sebelumnya. */}
        <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="w-full max-w-lg glass-panel-dark rounded-3xl p-6 border border-sand relative"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-ink flex items-center gap-2">
                  <Package className="h-5 w-5 text-accent" />
                  Tambah Bahan Baku Baru
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
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

              {successMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Nama Bahan</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Contoh: Sabun Cuci Cair Rinso"
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Kategori</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-white"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Satuan</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-white"
                    >
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Stok Awal</label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0"
                      value={formData.currentStock}
                      onChange={(e) => setFormData({...formData, currentStock: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Batas Min Stok</label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-3 rounded-xl glass-button text-sm font-bold text-stone-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-md"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Modal: Edit Material */}
        <AnimatePresence>
        {showEditModal && selectedMaterial && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="w-full max-w-lg glass-panel-dark rounded-3xl p-6 border border-sand relative"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-ink flex items-center gap-2">
                  <FileEdit className="h-5 w-5 text-accent" />
                  Edit Detail Bahan
                </h3>
                <button 
                  onClick={() => setShowEditModal(false)}
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

              {successMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Nama Bahan</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Contoh: Sabun Cuci Cair Rinso"
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Kategori</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-white"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Satuan</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm bg-white"
                    >
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Stok Saat Ini (Koreksi Stok di Menu Terpisah)</label>
                    <input
                      type="number"
                      disabled
                      value={formData.currentStock}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm opacity-60 cursor-not-allowed bg-sand/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">Batas Min Stok</label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-5 py-3 rounded-xl glass-button text-sm font-bold text-stone-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-md"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
}
