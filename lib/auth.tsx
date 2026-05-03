'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { HealthWorker } from '@/types';

interface AuthContextType {
  worker: HealthWorker | null;
  login: (worker: HealthWorker) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const KEY = 'nuruscreen_worker_id';
const WORKER_KEY = 'nuruscreen_worker_data';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = useState<HealthWorker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const data = localStorage.getItem(WORKER_KEY);
      if (data) {
        setWorker(JSON.parse(data));
      }
    } catch (e) {
      console.error('Auth load error:', e);
    }
    setIsLoading(false);
  }, []);

  const login = async (w: HealthWorker) => {
    try {
      localStorage.setItem(KEY, w.id);
      localStorage.setItem(WORKER_KEY, JSON.stringify(w));
    } catch (e) {
      console.error('Storage error:', e);
    }
    setWorker(w);
  };

  const logout = () => {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(WORKER_KEY);
    } catch (e) {}
    setWorker(null);
  };

  return (
    <AuthContext.Provider value={{ worker, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}