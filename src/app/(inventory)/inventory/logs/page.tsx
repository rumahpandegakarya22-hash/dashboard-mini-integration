"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/inventory/Navbar";
import OriginSelect from "@/components/inventory/OriginSelect";
import { GlassDateField } from "@/components/ui/GlassCalendar";
import {
  Activity,
  Search,
  User,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Filter,
  XCircle
} from "lucide-react";
import type { InvUser } from "@/components/inventory/Navbar";

interface ActivityLog {
  id: number;
  action: string;
  targetData: string | null;
  createdAt: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: "OWNER" | "STAFF";
}

interface AppUser {
  id: string;
  name: string;
  email: string;
}

const ACTION_TYPES = [
  { value: "", label: "Semua Jenis Aksi" },
  { value: "PURCHASE", label: "Pembelian" },
  { value: "USAGE", label: "Pemakaian" },
  { value: "CORRECTION", label: "Koreksi Stok" },
  { value: "MATERIAL", label: "Master Bahan" },
  { value: "USER", label: "Manajemen Pengguna" },
  { value: "OPNAME", label: "Stock Opname" },
];

export default function LogsPage() {
  const [currentUser, setCurrentUser] = useState<InvUser | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [userList, setUserList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterActionType, setFilterActionType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterUserId) params.set("userId", filterUserId);
      if (filterActionType) params.set("actionType", filterActionType);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const logsRes = await fetch(`/api/inventory/logs?${params.toString()}`);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  }, [filterUserId, filterActionType, filterFrom, filterTo]);

  useEffect(() => {
    async function loadInitial() {
      try {
        const profileRes = await fetch("/api/inventory/profile");
        if (profileRes.ok) {
          const data = await profileRes.json();
          setCurrentUser(data.user);
        }

        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUserList(data.users);
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
      }
    }
    loadInitial();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const hasActiveFilters = filterUserId || filterActionType || filterFrom || filterTo;

  const resetFilters = () => {
    setFilterUserId("");
    setFilterActionType("");
    setFilterFrom("");
    setFilterTo("");
    setSearch("");
  };

  // Text search is applied client-side on top of server-side filters
  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.userName.toLowerCase().includes(search.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(search.toLowerCase())
  );

  const isOwner = currentUser?.role === "OWNER";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight">Log Aktivitas Sistem</h1>
            <p className="text-taupe-dark text-sm mt-1 font-medium">
              Riwayat kronologis seluruh tindakan dalam sistem.
            </p>
          </div>

          {isOwner && (
            <div className="relative md:w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-taupe-dark" />
              <input
                type="text"
                placeholder="Cari aksi, nama, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl glass-input text-sm"
              />
            </div>
          )}
        </div>

        {currentUser?.role !== "OWNER" ? (
          <div className="glass-panel rounded-3xl p-8 border border-accent/25 text-center max-w-xl mx-auto mt-12">
            <ShieldAlert className="h-12 w-12 text-accent mx-auto mb-4" />
            <h3 className="text-ink font-bold text-lg">Akses Terbatas</h3>
            <p className="text-taupe-dark text-sm mt-2">
              Maaf, Anda login sebagai <span className="font-bold text-emerald-700">{currentUser?.role}</span>. Halaman audit log aktivitas sistem hanya dapat diakses oleh akun dengan tingkat kewenangan <span className="font-bold text-accent">OWNER</span>.
            </p>
          </div>
        ) : (
          <>
            {/* Filter Panel */}
            <div className="glass-panel rounded-3xl p-5 border border-sand/70 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Filter Log</h2>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Hapus Semua Filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-taupe-dark uppercase tracking-wider mb-1.5">
                    Pengguna
                  </label>
                  <OriginSelect
                    ariaLabel="Pengguna"
                    value={filterUserId}
                    onChange={setFilterUserId}
                    options={[
                      { value: '', label: 'Semua Pengguna' },
                      ...userList.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))
                    ]}
                    className="px-3 py-2.5 rounded-xl glass-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-taupe-dark uppercase tracking-wider mb-1.5">
                    Jenis Aksi
                  </label>
                  <OriginSelect
                    ariaLabel="Jenis Aksi"
                    value={filterActionType}
                    onChange={setFilterActionType}
                    options={ACTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    className="px-3 py-2.5 rounded-xl glass-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-taupe-dark uppercase tracking-wider mb-1.5">
                    Dari Tanggal
                  </label>
                  <GlassDateField
                    value={filterFrom}
                    onChange={setFilterFrom}
                    placeholder="Dari Tanggal"
                    buttonClassName="flex w-full items-center justify-between gap-2 px-3 py-2.5 rounded-xl glass-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-taupe-dark uppercase tracking-wider mb-1.5">
                    Sampai Tanggal
                  </label>
                  <GlassDateField
                    value={filterTo}
                    onChange={setFilterTo}
                    placeholder="Sampai Tanggal"
                    buttonClassName="flex w-full items-center justify-between gap-2 px-3 py-2.5 rounded-xl glass-input text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 border border-sand/70">
              <h2 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent animate-pulse" />
                Audit Trail Kronologis
                <span className="ml-auto text-xs font-semibold text-taupe-dark">
                  {filteredLogs.length} aktivitas
                </span>
              </h2>

              {loading ? (
                <div className="py-24 text-center">
                  <div className="w-10 h-10 rounded-full border-t-2 border-accent border-solid animate-spin mx-auto mb-4" />
                  <p className="text-taupe-dark font-medium">Memuat log audit...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-taupe-dark">
                  Tidak ada log aktivitas ditemukan.
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {filteredLogs.map((log) => {
                    const isLogOwner = log.userRole === "OWNER";
                    return (
                      <div
                        key={log.id}
                        className="p-4 rounded-2xl bg-white/60 border border-sand/70 flex flex-col md:flex-row md:items-start md:justify-between gap-4 hover:bg-blush/20 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-ink text-sm md:text-base leading-relaxed">
                            {log.action}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-taupe-dark">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(log.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {log.userName} ({log.userEmail})
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0 md:text-right border-t md:border-t-0 md:border-l border-sand/70 pt-3 md:pt-0 md:pl-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                            isLogOwner
                              ? "text-accent bg-blush/50 border-accent-soft/40"
                              : "text-emerald-700 bg-emerald-500/10 border-emerald-500/25"
                          }`}>
                            {isLogOwner ? (
                              <ShieldCheck className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            {log.userRole}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
