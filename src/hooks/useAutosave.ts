"use client";

import { useEffect, useState, useRef } from "react";
import { FORM_TYPE_HEADER } from "@/lib/tokenAccess";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

interface UseAutosaveProps {
  data: any;
  type: "natural" | "juridica";
  step: number;
  draftToken: string | null;
  onConflict?: (dbData: any, dbStep: number, dbUpdatedAt: string) => void;
}

export function useAutosave({ data, type, step, draftToken, onConflict }: UseAutosaveProps) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const dataRef = useRef(data);
  const typeRef = useRef(type);
  const stepRef = useRef(step);
  const draftTokenRef = useRef(draftToken);
  const onConflictRef = useRef(onConflict);
  
  const isFirstMount = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const prevDataStrRef = useRef(JSON.stringify(data));
  const lastSavedAtRef = useRef<string | undefined>(undefined);

  // Sync refs on each render to prevent stale closure variables in the async timeout
  useEffect(() => {
    dataRef.current = data;
    typeRef.current = type;
    stepRef.current = step;
    draftTokenRef.current = draftToken;
    onConflictRef.current = onConflict;
  });

  /**
   * Envía el borrador al servidor. Con `force` se usa la marca de tiempo actual
   * del servidor, de modo que la escritura se acepta y el estado local gana:
   * se invoca cuando el usuario decide conservar sus cambios ante un conflicto.
   */
  const persist = async (force = false): Promise<boolean> => {
    const token = draftTokenRef.current;
    if (!token) return false;

    setStatus("saving");

    try {
      const response = await fetch("/api/trpc/saveDraft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          [FORM_TYPE_HEADER]: typeRef.current === "natural" ? "NATURAL" : "JURIDICA",
        },
        body: JSON.stringify({
          data: dataRef.current,
          step: stepRef.current,
          // Omitir la marca fuerza la aceptación: el servidor solo compara
          // cuando el cliente declara desde qué versión viene.
          ...(force ? {} : { clientLastSavedAt: lastSavedAtRef.current }),
        }),
      });

      if (!response.ok) {
        setStatus("error");
        return false;
      }

      const resJson = await response.json();
      if (resJson.error) {
        console.error("[useAutosave] tRPC error response:", resJson.error);
        setStatus("error");
        return false;
      }

      const result = resJson.result?.data;
      if (!result || !result.success) {
        if (result?.conflict) {
          // No se toca el estado local: decide el usuario.
          console.warn("[useAutosave] Conflicto de concurrencia. Se conserva el estado local.");
          setStatus("conflict");
          if (onConflictRef.current) {
            onConflictRef.current(result.data, result.step, result.updatedAt);
          }
          return false;
        }
        setStatus("error");
        return false;
      }

      setStatus("saved");
      setLastSaved(new Date().toLocaleTimeString());
      lastSavedAtRef.current = result.updatedAt;
      return true;
    } catch (error) {
      console.error("[useAutosave] Error during autosave request:", error);
      setStatus("error");
      return false;
    }
  };

  const persistRef = useRef(persist);
  persistRef.current = persist;

  /** Guarda el estado local pisando la versión del servidor. */
  const forceSave = () => persistRef.current(true);

  useEffect(() => {
    // Skip on first mount (data loaded from localStorage is stable)
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const currentDataStr = JSON.stringify(data);
    const hasDataChanged = currentDataStr !== prevDataStrRef.current;
    prevDataStrRef.current = currentDataStr;

    // Only autosave when the form state actually changes
    if (!hasDataChanged) {
      return;
    }

    // Clear previous debounce timer on any key/field modification
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start a 2-second timer of inactivity before triggering the database save
    timeoutRef.current = setTimeout(() => {
      persistRef.current(false);
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, step, draftToken]);

  return { status, setStatus, lastSaved, setLastSaved, lastSavedAtRef, forceSave };
}
