import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex-1 p-6 md:p-8 space-y-6 overflow-hidden animate-pulse">
      
      {/* Title & Badge Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-[#00223a]/75 rounded-lg" />
          <div className="h-4 w-72 bg-[#00223a]/50 rounded-lg" />
        </div>
        <div className="h-8 w-28 bg-[#00223a]/75 rounded-lg" />
      </div>

      {/* Search & Filters Bar Skeleton */}
      <div className="bg-[#002b49]/40 border border-zinc-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full h-10 bg-[#001b2e]/60 rounded-xl" />
        <div className="w-full md:w-60 h-10 bg-[#001b2e]/60 rounded-xl" />
      </div>

      {/* Main Grid skeleton (Table + Inspector Sidebar) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Table Skeleton */}
        <div className="flex-1 bg-[#002b49]/20 border border-zinc-800/80 rounded-2xl overflow-hidden min-h-[400px] flex flex-col">
          <div className="h-12 bg-[#00223a]/50 border-b border-zinc-800" />
          <div className="flex-1 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between py-3 border-b border-zinc-800/40">
                <div className="h-4 w-20 bg-[#00223a]/65 rounded-lg" />
                <div className="h-4 w-40 bg-[#00223a]/50 rounded-lg" />
                <div className="h-4 w-28 bg-[#00223a]/65 rounded-lg" />
                <div className="h-4 w-16 bg-[#00223a]/50 rounded-lg" />
                <div className="h-4 w-24 bg-[#00223a]/55 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Floating loading overlay for premium user experience */}
        <div className="fixed inset-0 bg-[#001b2e]/25 backdrop-blur-[1px] pointer-events-none flex items-center justify-center z-10">
          <div className="bg-[#00223a]/90 border border-zinc-800 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
            <Loader2 className="w-5 h-5 text-[#c8a788] animate-spin" />
            <span className="text-xs font-semibold text-[#c8a788] uppercase tracking-wider">
              Cargando Panel...
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
