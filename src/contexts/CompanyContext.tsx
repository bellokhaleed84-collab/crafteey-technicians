"use client";

import { createContext, useContext } from "react";
import type { CompanyView } from "@/lib/useCompany";

type Value = { company: CompanyView; refresh: () => Promise<void> };

const CompanyContext = createContext<Value | null>(null);

export const CompanyProvider = CompanyContext.Provider;

/** The signed-in, approved company. Only works inside the dashboard layout. */
export function useCompanyContext(): Value {
  const value = useContext(CompanyContext);
  if (!value) throw new Error("useCompanyContext must be used inside the dashboard layout");
  return value;
}