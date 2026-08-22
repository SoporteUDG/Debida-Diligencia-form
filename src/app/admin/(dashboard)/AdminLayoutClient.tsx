"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  User,
  FileText,
  ShieldCheck,
  LogOut,
  ShieldAlert,
  Database,
  Network,
  Clock,
  Menu,
  X,
  UserCheck,
  ChevronRight
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminLayoutClient({
  children,
  admin,
  denied = false,
}: {
  children: React.ReactNode;
  admin: AdminUser;
  denied?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [liveTime, setLiveTime] = useState("");

  // Live clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleDateString("es-ES", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("[Logout Error]:", err);
      setIsLoggingOut(false);
    }
  };

  // 1. Acceso Denegado UI
  if (denied) {
    return (
      <div className="min-h-screen bg-[#001b2e] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-950/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md bg-[#002b49]/70 backdrop-blur-xl border border-red-900/30 rounded-3xl p-8 md:p-10 shadow-2xl text-center space-y-6 relative z-10 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-serif font-bold text-red-200">Acceso Denegado</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tu cuenta ({admin.email}) no cuenta con los permisos administrativos necesarios para acceder a la oficina de cumplimiento de UDG.
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-800/80">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/55 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoggingOut ? (
                <span className="inline-block w-4 h-4 border-2 border-red-450 border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Cerrar Sesión e Ir a Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Navigation items for the sidebar
  const navItems = [
    {
      label: "Expedientes",
      path: "/admin",
      icon: FileText,
      description: "Inspección y gestión de formularios",
    },
    {
      label: "Bitácora / Logs",
      path: "/admin/audit",
      icon: ShieldCheck,
      description: "Registro de acciones administrativas",
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#001b2e] text-zinc-100 flex font-sans selection:bg-[#c8a788]/30">
      
      {/* Sidebar Navigation */}
      <aside
        className={`bg-[#00223a] border-r border-zinc-800 flex flex-col z-20 transition-all duration-300 ${
          isSidebarOpen ? "w-64" : "w-20"
        } shrink-0 fixed h-full lg:sticky lg:top-0`}
      >
        {/* Sidebar Header */}
        <div className="h-[80px] border-b border-zinc-800 px-5 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden select-none">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              <Image
                src="/Logo UDG V2.png"
                alt="Logo UDG"
                fill
                className="object-contain"
                priority
              />
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col shrink-0 animate-fadeIn">
                <span className="text-xs font-serif font-semibold text-white tracking-wider uppercase">
                  UDG Cumplimiento
                </span>
                <span className="text-[9px] text-[#c8a788] font-bold uppercase tracking-[0.15em] -mt-0.5">
                  Backoffice
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <div key={item.label} className="relative group">
                <Link
                  href={item.disabled ? "#" : item.path}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault();
                    }
                  }}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 select-none ${
                    item.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : isActive
                      ? "bg-[#c8a788] text-zinc-950 font-bold shadow-md shadow-[#c8a788]/10"
                      : "text-zinc-400 hover:text-white hover:bg-white/5 active:scale-98 cursor-pointer"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {isSidebarOpen && (
                    <div className="flex flex-col animate-fadeIn">
                      <span className="text-xs">{item.label}</span>
                      <span className={`text-[8px] font-medium leading-none mt-0.5 ${
                        isActive ? "text-zinc-800" : "text-zinc-500"
                      }`}>
                        {item.description}
                      </span>
                    </div>
                  )}
                  {isSidebarOpen && isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto text-zinc-850 shrink-0" />
                  )}
                </Link>
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#002b49] border border-zinc-800 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition duration-150 z-30 shadow-xl whitespace-nowrap">
                    <p className="font-bold">{item.label}</p>
                    <p className="text-[8px] text-zinc-400 mt-0.5">{item.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer (Profile Info & Logout) */}
        <div className="border-t border-zinc-800 p-4 bg-zinc-950/10 space-y-3 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden select-none">
            <div className="w-10 h-10 rounded-xl bg-[#c8a788]/15 border border-[#c8a788]/30 flex items-center justify-center shrink-0 text-[#c8a788]">
              <UserCheck className="w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col overflow-hidden animate-fadeIn">
                <span className="text-xs font-semibold text-white truncate">
                  {admin.name}
                </span>
                <span className="text-[9px] text-[#c8a788] font-bold uppercase tracking-wider mt-0.5">
                  {admin.role}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              isSidebarOpen
                ? "bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/55"
                : "bg-red-950/20 text-red-400 hover:bg-red-900/30"
            }`}
            title="Cerrar Sesión"
          >
            {isLoggingOut ? (
              <span className="inline-block w-4 h-4 border-2 border-red-450 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {isSidebarOpen && "Cerrar Sesión"}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-[80px] bg-[#002b49] border-b border-zinc-800 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition shrink-0 cursor-pointer"
              title={isSidebarOpen ? "Contraer menú" : "Expandir menú"}
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="hidden sm:flex flex-col">
              <h2 className="text-sm font-serif font-bold text-white tracking-wide uppercase">
                Oficina de Cumplimiento UDG
              </h2>
              <p className="text-[9px] text-zinc-400 uppercase tracking-widest -mt-0.5">
                Panel Administrativo
              </p>
            </div>
          </div>

          {/* Status Indicators & Live Time */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden md:flex items-center gap-4 text-[10px]">
              {/* Neon DB Status */}
              <div className="flex items-center gap-2 bg-zinc-950/35 border border-zinc-800/80 px-3 py-1.5 rounded-xl">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-zinc-400 uppercase font-semibold">Neon DB:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-white uppercase text-[8px] tracking-wider">Activo</span>
                </div>
              </div>

              {/* Zoho Status */}
              <div className="flex items-center gap-2 bg-zinc-950/35 border border-zinc-800/80 px-3 py-1.5 rounded-xl">
                <Network className="w-3.5 h-3.5 text-[#c8a788]" />
                <span className="text-zinc-400 uppercase font-semibold">Zoho CRM:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-white uppercase text-[8px] tracking-wider">Activo</span>
                </div>
              </div>
            </div>

            {/* Live Clock */}
            {liveTime && (
              <div className="flex items-center gap-2 bg-zinc-950/25 border border-zinc-850 px-3.5 py-1.5 rounded-xl text-zinc-400 text-[10px] font-mono select-none">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="capitalize text-zinc-300">{liveTime}</span>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic page children rendering */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>

      </div>
    </div>
  );
}
