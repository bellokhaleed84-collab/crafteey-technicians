"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type CompanyView = {
  businessName: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  statusReason?: string;
  agreement?: { signed?: boolean; version?: string };
  verified?: boolean;
  isOnline?: boolean;
  logoUrl?: string;
  trades?: string[];
  areas?: string[];
  createdAt: string;
};

type State = { loading: boolean; company: CompanyView | null; error: string | null };

/** Loads the signed-in owner's company from /api/company/me. */
export function useCompany() {
  const { user, loading: authLoading, getToken } = useAuth();
  const [state, setState] = useState<State>({ loading: true, company: null, error: null });

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setState({ loading: false, company: null, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/company/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't load your company.");
      setState({ loading: false, company: data.company ?? null, error: null });
    } catch (err) {
      setState({
        loading: false,
        company: null,
        error: err instanceof Error ? err.message : "Couldn't load your company.",
      });
    }
  }, [getToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, company: null, error: null });
      return;
    }
    refresh();
  }, [authLoading, user, refresh]);

  return { ...state, loading: state.loading || authLoading, refresh };
}