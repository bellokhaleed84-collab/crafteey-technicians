"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyCompany, routeForCompany } from "@/lib/companyApi";

export default function SplashPage() {
  const { user, loading, getToken } = useAuth();
  const router = useRouter();
  const routed = useRef(false);

  useEffect(() => {
    if (loading || routed.current) return;

    if (!user) {
      routed.current = true;
      router.replace("/login");
      return;
    }

    routed.current = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const company = await fetchMyCompany(token);
        router.replace(company ? routeForCompany(company) : "/login");
      } catch {
        router.replace("/login");
      }
    })();
  }, [loading, user, getToken, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-ink px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-brand text-4xl font-black text-brand-ink">
          C
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Crafteey</h1>
          <p className="text-sm font-medium text-brand">Technicians</p>
        </div>
      </div>
      <p className="absolute bottom-16 text-xs text-white/50">
        Grow your repair and building business
      </p>
    </main>
  );
}