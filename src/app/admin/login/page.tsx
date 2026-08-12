"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, Lock, Mail, Loader2, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Pre-seed credentials note for ease of local testing
  useEffect(() => {
    console.log("[UDG Admin] Default developer credentials: admin@udg.com / admin123");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Credenciales incorrectas");
      }

      // Login success, redirect to dashboard
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001b2e] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background radial gradient decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-950/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#c8a788]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card panel with glassmorphism */}
      <div className="w-full max-w-md bg-[#002b49]/70 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 md:p-10 shadow-2xl space-y-8 relative z-10">
        
        <div className="text-center space-y-2">
          <div className="relative w-48 h-24 flex items-center justify-center mx-auto mb-2">
            <Image 
              src="/Logo UDG.png" 
              alt="Logo UDG" 
              width={192} 
              height={96} 
              className="object-contain" 
              style={{ mixBlendMode: "screen" }}
              priority
            />
          </div>
          <div className="pt-1">
            <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-bold mt-1">
              Oficina de Cumplimiento UDG
            </p>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 flex gap-3 items-start animate-fadeIn">
            <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-red-200">Acceso Denegado</p>
              <p className="text-[11px] text-red-300/90 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Login form layout */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email input field */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 block" htmlFor="email">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="email"
                type="email"
                required
                placeholder="ejemplo@udg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#001b2e] border border-zinc-700/80 rounded-xl pl-11 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-[#c8a788] focus:ring-1 focus:ring-[#c8a788]/20 transition disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password input field */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 block" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#001b2e] border border-zinc-700/80 rounded-xl pl-11 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-[#c8a788] focus:ring-1 focus:ring-[#c8a788]/20 transition disabled:opacity-50"
              />
            </div>
          </div>

          {/* Submit action button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-[#c8a788] to-yellow-600 hover:to-yellow-500 text-zinc-950 font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8a788]/5 disabled:opacity-75 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                Autenticando Oficial...
              </>
            ) : (
              <>
                Iniciar Sesión
                <ArrowRight className="w-4 h-4 text-zinc-950" />
              </>
            )}
          </button>
        </form>

        {/* Developer credentials reminder in card footer */}
        <div className="text-center">
          <p className="text-[9px] text-zinc-500 tracking-wider">
            Para pruebas locales use: <strong className="text-zinc-400">admin@udg.com</strong> / <strong className="text-zinc-400">admin123</strong>
          </p>
        </div>

      </div>
    </div>
  );
}
