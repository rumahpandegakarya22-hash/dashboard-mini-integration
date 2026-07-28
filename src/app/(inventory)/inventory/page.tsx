"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/inventory/Navbar";
import Link from "next/link";
import { 
  Package, 
  ShoppingCart, 
  Activity, 
  AlertTriangle, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  History,
  FileSpreadsheet
} from "lucide-react";
import type { InvUser } from "@/components/inventory/Navbar";

interface DashboardStats {
  totalItems: number;
  lowStockItemsCount: number;
  recentTxsCount: number;
  lowStockItems: Array<{
    id: number;
    name: string;
    category: string;
    currentStock: number;
    minStock: number;
    unit: string;
  }>;
}

export default function Dashboard() {
  const [user, setUser] = useState<InvUser | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItemsCount: 0,
    recentTxsCount: 0,
    lowStockItems: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch user profile
        const userRes = await fetch("/api/inventory/profile");
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        // Fetch materials and calculate statistics
        const materialsRes = await fetch("/api/inventory/materials");
        const transactionsRes = await fetch("/api/inventory/transactions");

        if (materialsRes.ok && transactionsRes.ok) {
          const matData = await materialsRes.json();
          const txData = await transactionsRes.json();

          const total = matData.materials.length;
          const lowStock = matData.materials.filter(
            (m: any) => m.currentStock <= m.minStock
          );
          
          setStats({
            totalItems: total,
            lowStockItemsCount: lowStock.length,
            recentTxsCount: txData.transactions.length,
            lowStockItems: lowStock
          });
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-4" />
            <p className="text-taupe-dark font-medium">Memuat dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = user?.role === "OWNER";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-ink tracking-tight">
            Selamat Datang,{" "}
            <span className="text-accent">
              {user?.name}
            </span>
          </h1>
          <p className="text-taupe-dark mt-1.5 font-medium">
            Berikut adalah ringkasan inventaris kost hari ini. Anda masuk sebagai{" "}
            <span className="text-ink font-bold uppercase">{user?.role}</span>.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Stat 1: Total Bahan */}
          <div className="glass-card border-beam rounded-2xl p-6 relative overflow-hidden flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-taupe-dark text-sm font-semibold tracking-wider uppercase">
                Total Bahan Master
              </span>
              <span className="text-4xl font-extrabold text-ink mt-2">{stats.totalItems}</span>
              <Link href="/inventory/materials" className="text-accent hover:text-accent-dark text-xs font-semibold flex items-center gap-1 mt-4 transition-colors">
                Lihat Semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-4 rounded-2xl bg-accent/10 text-accent border border-accent/20">
              <Package className="h-8 w-8" />
            </div>
          </div>

          {/* Stat 2: Stok Menipis */}
          <div className={`glass-card border-beam rounded-2xl p-6 relative overflow-hidden flex items-center justify-between border ${
            stats.lowStockItemsCount > 0 
              ? "border-accent/25 bg-accent/[0.03]" 
              : "border-sand/70"
          }`}>
            <div className="flex flex-col">
              <span className="text-taupe-dark text-sm font-semibold tracking-wider uppercase">
                Stok Menipis (Peringatan)
              </span>
              <span className="text-4xl font-extrabold text-ink mt-2">{stats.lowStockItemsCount}</span>
              <span className="text-xs text-taupe-dark mt-4">
                {stats.lowStockItemsCount > 0 
                  ? "Segera lakukan pembelian!" 
                  : "Semua stok dalam batas aman."}
              </span>
            </div>
            <div className={`p-4 rounded-2xl border ${
              stats.lowStockItemsCount > 0 
                ? "bg-accent/10 text-accent border-accent/25 animate-pulse" 
                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
            }`}>
              <AlertTriangle className="h-8 w-8" />
            </div>
          </div>

          {/* Stat 3: Total Mutasi */}
          <div className="glass-card border-beam rounded-2xl p-6 relative overflow-hidden flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-taupe-dark text-sm font-semibold tracking-wider uppercase">
                Transaksi Dicatat
              </span>
              <span className="text-4xl font-extrabold text-ink mt-2">{stats.recentTxsCount}</span>
              <span className="text-xs text-taupe-dark mt-4">Total mutasi stok di sistem</span>
            </div>
            <div className="p-4 rounded-2xl bg-blush/50 text-accent border border-accent-soft/40">
              <History className="h-8 w-8" />
            </div>
          </div>
        </div>

        {/* Quick Actions & Low Stock Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Quick Actions Panel */}
          <div className="lg:col-span-1 glass-card rounded-3xl p-6 border border-sand/70 h-fit">
            <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-accent rounded" />
              Aksi Cepat
            </h2>
            <div className="flex flex-col gap-3">
              <Link
                href="/inventory/purchases"
                className="w-full py-4 px-4 rounded-2xl bg-accent hover:bg-accent-dark text-white font-bold transition-all duration-300 shadow-md flex items-center justify-between group"
              >
                <span className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5" />
                  Catat Belanja Bahan
                </span>
                <TrendingUp className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                href="/inventory/usages"
                className="w-full py-4 px-4 rounded-2xl glass-button border border-sand text-ink font-bold transition-all duration-300 flex items-center justify-between group"
              >
                <span className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-emerald-700" />
                  Catat Pemakaian
                </span>
                <TrendingDown className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/inventory/opname"
                className="w-full py-4 px-4 rounded-2xl glass-button border border-sand text-ink font-bold transition-all duration-300 flex items-center justify-between group"
              >
                <span className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-accent" />
                  Stok Opname Bulanan
                </span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Low Stock Warning List */}
          <div className="lg:col-span-2 glass-card rounded-3xl p-6 border border-sand/70">
            <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-accent rounded" />
              Notifikasi Stok Menipis (Rekomendasi Belanja)
            </h2>

            {stats.lowStockItems.length === 0 ? (
              <div className="py-12 text-center">
                <div className="p-3 bg-emerald-500/10 text-emerald-700 rounded-full w-fit mx-auto mb-3 border border-emerald-500/25">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-ink font-bold">Semua Aman</h3>
                <p className="text-taupe-dark text-sm mt-1">Tidak ada bahan yang berada di bawah batas minimum.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {stats.lowStockItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-2xl bg-white/60 border border-sand/70 flex items-center justify-between hover:bg-blush/25 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-ink text-sm md:text-base">{item.name}</span>
                      <span className="text-xs text-taupe-dark mt-1 uppercase font-semibold tracking-wider">
                        Kategori: {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-taupe-dark">Stok saat ini</span>
                        <span className="font-extrabold text-accent text-sm md:text-base">
                          {item.currentStock} {item.unit}
                        </span>
                      </div>
                      <div className="flex flex-col text-right border-l border-sand/70 pl-4">
                        <span className="text-xs text-taupe-dark">Batas Min</span>
                        <span className="font-semibold text-stone-700 text-sm">
                          {item.minStock} {item.unit}
                        </span>
                      </div>
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
