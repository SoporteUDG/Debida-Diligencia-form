"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  hasError?: boolean;
}

export default function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecciona una opción...",
  className = "",
  hasError = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Normalizes string to match search ignoring accents
  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const filteredOptions = (options || []).filter((opt) => {
    if (typeof opt !== "string") return false;
    return removeAccents(opt.toLowerCase()).includes(removeAccents(search.toLowerCase()));
  });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch(""); // Reset search on open
        }}
        className={`w-full border rounded-lg px-4 py-3 text-sm text-left flex items-center justify-between text-zinc-800 focus:outline-none focus:ring-1 transition cursor-pointer ${
          hasError
            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "bg-[#f4f6f8] border-zinc-350 focus:border-[#002b49] focus:ring-[#002b49]/20"
        }`}
      >
        <span className={value ? "text-zinc-800" : "text-zinc-450"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-300 rounded-lg shadow-2xl overflow-hidden animate-fadeIn text-zinc-800">
          {/* Search Input */}
          <div className="p-2 border-b border-zinc-200 flex items-center gap-2 bg-[#f4f6f8]">
            <Search className="h-4 w-4 text-zinc-450 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-xs text-zinc-800 focus:outline-none placeholder-zinc-450"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <ul className="max-h-56 overflow-y-auto py-1 text-xs">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-3 text-zinc-400 text-center">No se encontraron resultados</li>
            ) : (
              filteredOptions.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-zinc-100 hover:text-zinc-950 transition cursor-pointer ${
                      value === opt ? "bg-[#c8a788]/20 text-amber-950 font-semibold" : "text-zinc-700"
                    }`}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
