"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Package,
  ShoppingCart,
  Activity,
  ClipboardList,
  Sliders,
  ArrowLeft,
  Menu,
  X,
  User,
  ShieldCheck,
  Wrench
} from "lucide-react";

/** Identitas yang dipakai chrome Inventory. Dulu MockUser dari app lama; kini
 *  diturunkan dari sesi Clerk repo ini lewat /api/inventory/profile. */
export interface InvUser {
  name: string;
  role: "OWNER" | "STAFF";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<InvUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/inventory/profile");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Sesi Clerk boleh jadi ada, tapi akun ini belum diundang/dikenali di
          // aplikasi (lihat syncAppUser() di authHelper.ts). Jangan biarkan tetap
          // di shell aplikasi — usir ke /login supaya tidak "terlihat" masuk.
          setUser(null);
          router.replace("/login");
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [pathname, router]);


  if (loading) {
    return (
      <header className="sticky top-0 w-full z-50 glass-panel border-b px-6 py-4 flex justify-between items-center h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 animate-pulse" />
          <div className="w-32 h-4 rounded bg-sand/60 animate-pulse" />
        </div>
        <div className="w-24 h-8 rounded bg-sand/60 animate-pulse" />
      </header>
    );
  }

  if (!user) return null;

  const isOwner = user.role === "OWNER";

  const navigation = [
    { name: "Dashboard", href: "/inventory", icon: ClipboardList, roles: ["OWNER", "STAFF"] },
    { name: "Daftar Bahan", href: "/inventory/materials", icon: Package, roles: ["OWNER", "STAFF"] },
    { name: "Daftar Alat", href: "/inventory/alat", icon: Wrench, roles: ["OWNER", "STAFF"] },
    { name: "Pembelian (+)", href: "/inventory/purchases", icon: ShoppingCart, roles: ["OWNER", "STAFF"] },
    { name: "Pemakaian (-)", href: "/inventory/usages", icon: Activity, roles: ["OWNER", "STAFF"] },
    { name: "Koreksi Stok", href: "/inventory/corrections", icon: Sliders, roles: ["OWNER"] },
    { name: "Laporan Opname", href: "/inventory/opname", icon: ClipboardList, roles: ["OWNER"] },
    { name: "Log Aktivitas", href: "/inventory/logs", icon: Activity, roles: ["OWNER"] },
  ];

  return (
    <nav className="sticky top-0 w-full z-50 glass-panel border-b border-sand/70 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/inventory" className="flex items-center gap-2 group">
              <div className="p-2 rounded-xl bg-accent shadow-lg group-hover:scale-105 transition-all duration-300">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="font-extrabold text-lg text-ink tracking-wide">
                KostInventory
              </span>
            </Link>
          </div>

          {/* Desktop Navigation — pil aktif meluncur antar item (shared layoutId),
              padanan "sidebar" untuk chrome nav Inventory yang berbentuk topbar. */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigation.map((item) => {
              if (!item.roles.includes(user.role)) return null;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-accent"
                      : "text-stone-700 hover:bg-blush/30 hover:text-ink border border-transparent"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="inv-nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                      className="absolute inset-0 rounded-xl bg-accent/10 border border-accent/20"
                    />
                  )}
                  <item.icon className="h-4 w-4 relative" />
                  <span className="relative">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* User Profile & Logout */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-sand/40 border border-sand/70">
              <div className="p-1 rounded-lg bg-accent/10 text-accent">
                {isOwner ? <ShieldCheck className="h-4 w-4 text-accent" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-ink leading-tight">{user.name}</span>
                <span className="text-[10px] text-taupe-dark uppercase tracking-wider font-bold">
                  {user.role}
                </span>
              </div>
            </div>
            
            <a
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-accent bg-accent/10 border border-accent/25 hover:bg-accent/15 transition-all duration-300"
              title="Kembali ke Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-taupe-dark hover:text-ink hover:bg-blush/30 transition-all duration-200"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="lg:hidden glass-panel border-t border-sand/70 overflow-hidden"
        >
        <div className="px-2 pt-2 pb-4 space-y-1">
          <a
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-accent bg-accent/10 border border-accent/25"
          >
            <ArrowLeft className="h-5 w-5" />
            Kembali ke Dashboard
          </a>
          {navigation.map((item) => {
            if (!item.roles.includes(user.role)) return null;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-accent/15 border border-accent/25 text-accent"
                    : "text-stone-700 hover:bg-blush/30 hover:text-ink"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
          
          <div className="pt-4 pb-2 border-t border-sand/70 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sand/40 text-accent">
                {isOwner ? <ShieldCheck className="h-5 w-5 text-accent" /> : <User className="h-5 w-5" />}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-ink">{user.name}</span>
                <span className="text-xs text-taupe-dark uppercase tracking-wider font-bold">
                  {user.role}
                </span>
              </div>
            </div>
            <a
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-accent bg-accent/10 border border-accent/25 transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </a>
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </nav>
  );
}
