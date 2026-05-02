'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { worker, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !worker) router.replace('/login'); }, [worker, isLoading, router]);
  if (isLoading) return <div className="app-shell" style={{ alignItems:'center', justifyContent:'center' }}><div className="spinner" style={{ borderTopColor:'var(--forest)', borderColor:'var(--stone-200)' }} /></div>;
  if (!worker) return null;
  return <div className="app-shell"><div className="page-content">{children}</div><BottomNav /></div>;
}
