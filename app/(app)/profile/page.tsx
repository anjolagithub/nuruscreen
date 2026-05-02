'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getDashboardStats } from '@/lib/db';

export default function ProfilePage() {
  const { worker, logout } = useAuth(); const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { if (worker) getDashboardStats(worker.id).then(setStats); }, [worker]);
  return (
    <div>
      <div className="page-header"><h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Profile</h1></div>
      <div style={{ padding:'20px 20px 0', display:'flex', flexDirection:'column', gap:14 }}>
        <div className="card card-padded">
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--forest)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'white' }}>👤</div>
            <div><div style={{ fontWeight:700, fontSize:18 }}>{worker?.name}</div><div style={{ fontSize:14, color:'var(--stone-400)' }}>{worker?.facility}</div></div>
          </div>
          {stats && <div style={{ display:'flex', gap:10, paddingTop:14, borderTop:'1px solid var(--stone-100)' }}>
            <div className="stat-card" style={{ flex:1 }}><div className="stat-number">{stats.totalChildren}</div><div className="stat-label">Children</div></div>
            <div className="stat-card" style={{ flex:1 }}><div className="stat-number">{stats.totalScreenings}</div><div className="stat-label">Screenings</div></div>
            <div className="stat-card" style={{ flex:1 }}><div className="stat-number" style={{ color:'var(--risk-red)' }}>{stats.riskCounts.red}</div><div className="stat-label" style={{ color:'var(--risk-red)' }}>Referred</div></div>
          </div>}
        </div>
        <div className="card card-padded">
          <p className="form-label" style={{ marginBottom:10 }}>About NuruScreen</p>
          <p style={{ margin:'0 0 8px', fontSize:14, lineHeight:1.6, color:'var(--stone-600)' }}>Uses on-device AI to estimate MUAC — WHO standard for detecting acute malnutrition in children aged 6–59 months.</p>
          <p style={{ margin:0, fontSize:14, lineHeight:1.6, color:'var(--stone-600)' }}>≥13.5cm = Green · 11.5–13.5cm = Yellow · &lt;11.5cm = Red</p>
        </div>
        <div className="card card-padded" style={{ background:'var(--stone-50)' }}>
          <p className="form-label" style={{ marginBottom:6 }}>Open Source · MIT License</p>
          <p style={{ margin:0, fontSize:13, color:'var(--stone-600)' }}>Built for UNICEF Venture Fund climate cohort. All data stays on device.</p>
        </div>
        <button className="btn-secondary" onClick={() => { if (confirm('Switch health worker?')) { logout(); router.replace('/login'); } }} style={{ color:'var(--risk-red)', background:'var(--risk-red-bg)' }}>Switch Health Worker</button>
      </div>
    </div>
  );
}
