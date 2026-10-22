"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PartyView } from "@/lib/views";

/** Loads the employer or worker view for a link token, with an explicit refresh and replace. */
export function usePartyView(role: "e" | "w", token: string) {
  const [view, setView] = useState<PartyView | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setView(await api<PartyView>(`/api/${role}/${token}`, { signal }));
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof ApiError ? { status: err.status, message: err.message } : { status: 0, message: "Couldn't load this page." });
      }
    },
    [role, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { view, error, setView, reload: () => load() };
}
