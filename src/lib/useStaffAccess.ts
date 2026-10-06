"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyStaffAccess, type StaffAccess } from "@/lib/staffApi";

type State = { loading: boolean; access: StaffAccess | null; error: string | null };

/** Whether the signed-in person is staff at a company. */
export function useStaffAccess() {
  const { user, loading: authLoading, getToken } = useAuth();
  const [state, setState] = useState<State>({ loading: true, access: null, error: null });

  // silent = keep the current screen instead of showing the skeleton again.
  const check = useCallback(
    async (silent = false) => {
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const token = await getToken();
        if (!token) {
          setState({ loading: false, access: null, error: null });
          return;
        }
        const access = await fetchMyStaffAccess(token);
        setState({ loading: false, access, error: null });
      } catch {
        setState({ loading: false, access: null, error: "Couldn't check your account. Try again." });
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, access: null, error: null });
      return;
    }
    void check();
  }, [authLoading, user, check]);

  const refresh = useCallback(() => check(true), [check]);

  return { ...state, loading: state.loading || authLoading, user, refresh };
}