'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Provenance } from '@payslip-insight/schema';

type ProvenanceContextValue = {
  highlighted: Provenance | null;
  setHighlighted: (prov: Provenance | null) => void;
};

const ProvenanceContext = createContext<ProvenanceContextValue | null>(null);

export function ProvenanceProvider({ children }: { children: ReactNode }) {
  const [highlighted, setHighlighted] = useState<Provenance | null>(null);
  const value = useMemo(() => ({ highlighted, setHighlighted }), [highlighted]);
  return <ProvenanceContext.Provider value={value}>{children}</ProvenanceContext.Provider>;
}

export function useProvenance(): ProvenanceContextValue {
  const ctx = useContext(ProvenanceContext);
  if (!ctx) throw new Error('useProvenance must be used within a ProvenanceProvider');
  return ctx;
}
