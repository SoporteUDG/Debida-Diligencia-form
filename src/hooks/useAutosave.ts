"use client";

import { useEffect, useState, useRef } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

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
    timeoutRef.current = setTimeout(async () => {
      const token = draftTokenRef.current;
      if (!token) return;

      setStatus("saving");

      try {
        const response = await fetch("/api/trpc/saveDraft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: dataRef.current,
            step: stepRef.current,
            clientLastSavedAt: lastSavedAtRef.current,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.error) {
            console.error("[useAutosave] tRPC error response:", resJson.error);
            setStatus("error");
            return;
          }

          const result = resJson.result?.data;
          if (result && result.success) {
            if (result.conflict) {
              console.warn("[useAutosave] Concurrency conflict detected. Database version is newer.");
              setStatus("error");
              if (onConflictRef.current) {
                onConflictRef.current(result.data, result.step, result.updatedAt);
              }
            } else {
              setStatus("saved");
              setLastSaved(new Date().toLocaleTimeString());
              lastSavedAtRef.current = result.updatedAt;
            }
          } else {
            setStatus("error");
          }
        } else {
          setStatus("error");
        }
      } catch (error) {
        console.error("[useAutosave] Error during autosave request:", error);
        setStatus("error");
      }
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, step, draftToken]);

  return { status, setStatus, lastSaved, setLastSaved, lastSavedAtRef };
}
