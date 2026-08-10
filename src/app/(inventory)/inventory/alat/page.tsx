"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "@/components/inventory/Navbar";
import FlowButton from "@/components/inventory/FlowButton";
import OriginSelect from "@/components/inventory/OriginSelect";
import {
  Wrench,
  Search,
  Plus,
  Edit2,
  X,
  AlertTriangle,
  CheckCircle,
  FileEdit,
} from "lucide-react";
import type { InvUser } from "@/components/inventory/Navbar";

interface AlatRow {
  id: number;
  nama: string;
  kategori: string;
  kondisi: string;
  jumlah: number;
  catatan: string;
}

const KATEGORI_ALAT = [
  "Kebersihan",
  "Pertukangan",
  "Elektrikal",
  "Plumbing",
  "Keamanan",
  "Lainnya",
];

const KONDISI_OPTIONS = [
  { value: "Baru", label: "Baru" },
  { value: "Bekas", label: "Bekas" },
];

export default function AlatPage() {
  const [user, setUser] = useState<InvUser | null>(null);
  const [alat, setAlat] = useState<AlatRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAlat, setSelectedAlat] = useState<AlatRow | null>(null);

  const [formData, setFormData] = useState({
    nama: "",
    kategori: "Kebersihan",
    kondisi: "Baru",
    jumlah: "1",
    catatan: "",
  });
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch("/api/inventory/profile");
      if (userRes.ok) {
        const d = await userRes.json();
        setUser(d.user);
      }
      const res = await fetch("/api/inventory/alat");
      if (res.ok) {
        const d = await res.json();
        setAlat(d.alat);
      }
    } catch (err) {
      console.error("Error loading alat:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ nama: "", kategori: "Kebersihan", kondisi: "Baru", jumlah: "1", catatan: "" });
    setFormError("");
    setSuccessMsg("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: AlatRow) => {
    setSelectedAlat(item);
    setFormData({
      nama: item.nama,
      kategori: item.kategori,
      kondisi: item.kondisi || "Baru",
      jumlah: String(item.jumlah),
      catatan: item.catatan || "",
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
      const res = await fetch("/api/inventory/alat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: formData.nama,
          kategori: formData.kategori,
          kondisi: formData.kondisi,
          jumlah: parseInt(formData.jumlah) || 1,
          catatan: formData.catatan,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Alat berhasil ditambahkan!");
        setTimeout(() => {
          setShowAddModal(false);
          loadData();
        }, 1500);
      } else {
        setFormError(data.error || "Gagal menambahkan alat");
      }
    } catch {
      setFormError("Koneksi gagal");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");
    if (!selectedAlat) return;
    try {
      const res = await fetch("/api/inventory/alat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedAlat.id,
          nama: formData.nama,
          kategori: formData.kategori,
          kondisi: formData.kondisi,
          jumlah: parseInt(formData.jumlah) || 1,
          catatan: formData.catatan,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Data alat berhasil diperbarui!");
        setTimeout(() => {
          setShowEditModal(false);
          loadData();
        }, 1500);
      } else {
        setFormError(data.error || "Gagal mengubah alat");
      }
    } catch {
      setFormError("Koneksi gagal");
    }
  };

  const filteredAlat = alat.filter(
    (a) =>
      a.nama.toLowerCase().includes(search.toLowerCase()) ||
      a.kategori.toLowerCase().includes(search.toLowerCase())
  );

  const isOwner = user?.role === "OWNER";

  const ModalForm = ({
    title,
    icon: Icon,
    onSubmit,
    onClose,
    submitLabel,
  }: {
    title: string;
    icon: React.ElementType;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
    submitLabel: string;
  }) => (
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
            <Icon className="h-5 w-5 text-accent" />
            {title}
          </h3>
          <button
            onClick={onClose}
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
              Nama Alat
            </label>
            <input
              type="text"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Sapu Ijuk"
              className="w-full px-4 py-3 rounded-xl glass-input text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                Kategori
              </label>
              <OriginSelect
                ariaLabel="Kategori"
                value={formData.kategori}
                onChange={(v) => setFormData({ ...formData, kategori: v })}
                options={KATEGORI_ALAT.map((c) => ({ value: c, label: c }))}
                className="px-4 py-3 rounded-xl glass-input text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
                Kondisi
              </label>
              <OriginSelect
                ariaLabel="Kondisi"
                value={formData.kondisi}
                onChange={(v) => setFormData({ ...formData, kondisi: v })}
                options={KONDISI_OPTIONS}
                className="px-4 py-3 rounded-xl glass-input text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
              Jumlah
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.jumlah}
              onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
              className="w-full px-4 py-3 rounded-xl glass-input text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-taupe-dark uppercase tracking-wider mb-2">
              Catatan
            </label>
            <textarea
              rows={2}
              value={formData.catatan}
              onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
              placeholder="Keterangan tambahan (opsional)"
              className="w-full px-4 py-3 rounded-xl glass-input text-sm resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl glass-button text-sm font-bold text-stone-700"
            >
              Batal
            </button>
            <FlowButton
              type="submit"
              className="pl-5 pr-11 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-md"
            >
              {submitLabel}
            </FlowButton>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight">Daftar Alat Inventaris</h1>
            <p className="text-taupe-dark text-sm mt-1 font-medium">
              Kelola peralatan dan inventaris fisik properti.
            </p>
          </div>

          <div className="flex items-center gap-3">
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
            {isOwner && (
              <button
                onClick={handleOpenAdd}
                className="py-3 px-5 rounded-2xl bg-accent hover:bg-accent-dark text-white font-bold text-sm transition-all duration-300 shadow-lg flex items-center gap-2 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Tambah Alat
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-4" />
            <p className="text-taupe-dark font-medium">Memuat data alat...</p>
          </div>
        ) : filteredAlat.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center border border-sand/70">
            <Wrench className="h-12 w-12 text-taupe-dark mx-auto mb-4" />
            <h3 className="text-ink font-bold text-lg">Alat Tidak Ditemukan</h3>
            <p className="text-taupe-dark text-sm mt-1">
              Coba cari dengan kata kunci lain atau tambahkan alat baru.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAlat.map((item) => (
              <div
                key={item.id}
                className="glass-card rounded-3xl p-6 border border-sand/70 relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                        {item.kategori}
                      </span>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 rounded-lg text-taupe-dark hover:text-ink hover:bg-blush/30 border border-transparent hover:border-sand/70 transition-all"
                        title="Edit Alat"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-ink tracking-wide mb-2 truncate">
                    {item.nama}
                  </h3>

                  {item.catatan && (
                    <p className="text-xs text-taupe-dark leading-relaxed line-clamp-2">
                      {item.catatan}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-sand/70 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-taupe-dark font-medium">Jumlah</span>
                    <span className="text-xl font-extrabold text-ink mt-1">
                      {item.jumlah} <span className="text-sm font-semibold text-taupe-dark">unit</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showAddModal && (
            <ModalForm
              title="Tambah Alat Baru"
              icon={Wrench}
              onSubmit={handleAddSubmit}
              onClose={() => setShowAddModal(false)}
              submitLabel="Simpan"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showEditModal && selectedAlat && (
            <ModalForm
              title="Edit Data Alat"
              icon={FileEdit}
              onSubmit={handleEditSubmit}
              onClose={() => setShowEditModal(false)}
              submitLabel="Simpan Perubahan"
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
