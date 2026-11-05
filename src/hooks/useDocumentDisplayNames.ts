"use client";

import { useCallback, useEffect, useState } from "react";
import { FORM_TYPE_HEADER } from "@/lib/tokenAccess";

/**
 * Nombres con los que el cliente subió sus archivos, por nombre interno.
 *
 * El formulario sigue guardando el nombre interno (el de Zoho), que es la clave
 * para borrar, sincronizar y generar el expediente; este mapa solo se usa para
 * mostrar el archivo. Un archivo sin nombre original se muestra con el interno.
 */
export function useDocumentDisplayNames(
  draftToken: string | null,
  formType: "NATURAL" | "JURIDICA",
  enabled: boolean
) {
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled || !draftToken) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/trpc/documents.getDraftDocuments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: formType,
          },
          body: JSON.stringify({ draftId: draftToken }),
        });
        const resJson = await response.json();
        const documents: { name: string; originalName?: string | null }[] = resJson.result?.data?.documents || [];
        if (cancelled) return;

        const loaded: Record<string, string> = {};
        for (const doc of documents) {
          if (doc.originalName) loaded[doc.name] = doc.originalName;
        }
        // Lo subido mientras se cargaba la lista tiene prioridad
        setDisplayNames((prev) => ({ ...loaded, ...prev }));
      } catch (error) {
        console.error("[useDocumentDisplayNames] Error loading document names:", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [draftToken, formType, enabled]);

  const rememberDisplayName = useCallback((storedName: string, originalName: string) => {
    setDisplayNames((prev) => ({ ...prev, [storedName]: originalName }));
  }, []);

  return { displayNames, rememberDisplayName };
}
