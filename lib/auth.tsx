'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { HealthWorker } from '@/types';
import { saveHealthWorker, getHealthWorker } from '@/lib/db';

interface AuthContextType { worker: HealthWorker | null; login: (w: HealthWorker) => Promise<void>; logout: () => void; isLoading: boolean; }
const AuthContext = createContext<AuthContextType | null>(null);
const KEY = 'nuruscreen_worker_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = useState<HealthWorker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const id = localStorage.getItem(KEY);
    if (id) { getHealthWorker(id).then(w => { if (w) setWorker(w); setIsLoading(false); }); }
    else setIsLoading(false);
  }, []);
  const login = async (w: HealthWorker) => {
  try {
    await saveHealthWorker(w);
  } catch (err) {
    console.error('DB error:', err);
  }
  localStorage.setItem(KEY, w.id);
  setWorker(w);
};
  const logout = () => { localStorage.removeItem(KEY); setWorker(null); };
  return <AuthContext.Provider value={{ worker, login, logout, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
