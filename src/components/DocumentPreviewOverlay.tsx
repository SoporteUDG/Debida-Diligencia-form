"use client";

import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface DocumentPreviewOverlayProps {
  /** Stored (Zoho) name: identifies the document on the server */
  storedName: string;
  /** Name shown to the client */
  displayName: string;
  draftToken: string | null;
  onClose: () => void;
}

export default function DocumentPreviewOverlay({ storedName, displayName, draftToken, onClose }: DocumentPreviewOverlayProps) {
  const t = useTranslations("DocumentPreview");
  const src = `/api/documents/preview?name=${encodeURIComponent(storedName)}&token=${encodeURIComponent(draftToken ?? "")}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 md:p-6 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={displayName}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <span className="min-w-0 truncate text-sm font-semibold text-[#052B48]">{displayName}</span>
          <div className="flex shrink-0 items-center gap-1">
            {/* Mobile browsers often cannot render a PDF inside an iframe */}
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-[#052B48]"
              title={t("OpenInNewTab")}
              aria-label={t("OpenInNewTab")}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="cursor-pointer rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-red-500"
              title={t("Close")}
              aria-label={t("Close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe src={src} title={displayName} className="w-full flex-1 border-0 bg-zinc-100" />
      </div>
    </div>
  );
}
