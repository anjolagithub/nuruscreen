'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getDashboardStats, getRecentScreenings } from '@/lib/db';
import { RISK_LABELS, RISK_COLORS, type Screening } from '@/types';

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now()-ts)/60000);
  if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60); if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

export default function DashboardPage() {
  const { worker } = useAuth(); const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<Screening[]>([]);
  const [online, setOnline] = useState(true);
  const h = new Date().getHours();
  const tod = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';

  useEffect(() => {
    setOnline(navigator.onLine);
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }, []);

  useEffect(() => {
    if (!worker) return;
    getDashboardStats(worker.id).then(setStats);
    getRecentScreenings(worker.id, 5).then(setRecent);
  }, [worker]);

  const atRisk = stats ? stats.riskCounts.yellow + stats.riskCounts.red : 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <p style={{ margin:'0 0 2px', opacity:0.7, fontSize:13 }}>Good {tod}</p>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>{worker?.name.split(' ')[0]}</h1>
            <p style={{ margin:'4px 0 0', opacity:0.65, fontSize:13 }}>{worker?.facility}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
            <div className={`pulse-dot ${online ? 'online' : 'offline'}`} />
            <span style={{ fontSize:12, opacity:0.8 }}>{online ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      <div style={{ padding:'20px 20px 0', display:'flex', gap:10 }}>
        <div className="stat-card"><div className="stat-number">{stats?.totalChildren ?? '—'}</div><div className="stat-label">Children</div></div>
        <div className="stat-card"><div className="stat-number">{stats?.totalScreenings ?? '—'}</div><div className="stat-label">Screenings</div></div>
        <div className="stat-card" style={{ background: atRisk > 0 ? 'var(--risk-red-bg)' : undefined }}>
          <div className="stat-number" style={{ color: atRisk > 0 ? 'var(--risk-red)' : undefined }}>{stats ? atRisk : '—'}</div>
          <div className="stat-label">At Risk</div>
        </div>
      </div>

      {stats && stats.totalScreenings > 0 && (
        <div style={{ padding:'16px 20px 0' }}>
          <div className="card card-padded">
            <p style={{ margin:'0 0 12px', fontSize:13, fontWeight:600, color:'var(--stone-600)' }}>RISK BREAKDOWN</p>
            {(['green','yellow','red'] as const).map(level => {
              const count = stats.riskCounts[level];
              const pct = (count / stats.totalScreenings) * 100;
              const c = { green:'var(--risk-green)', yellow:'var(--risk-yellow)', red:'var(--risk-red)' }[level];
              return <div key={level} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                  <span>{level === 'green' ? '🟢 Well Nourished' : level === 'yellow' ? '🟡 Moderate Risk' : '🔴 Severe Risk'}</span>
                  <span style={{ fontWeight:700, color:c }}>{count}</span>
                </div>
                <div style={{ height:6, background:'var(--stone-100)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:3, transition:'width 0.6s ease' }} />
                </div>
              </div>;
            })}
          </div>
        </div>
      )}

      <div style={{ padding:'16px 20px 0' }}>
        <button className="btn-primary" onClick={() => router.push('/screen')} style={{ borderRadius:14 }}>
          <span style={{ fontSize:20 }}>📷</span> Start New Screening
        </button>
      </div>

      <p className="section-title" style={{ marginTop:24 }}>Recent Screenings</p>
      {recent.length === 0 ? (
        <div className="empty-state"><div style={{ fontSize:40, marginBottom:12 }}>🔍</div><p style={{ margin:0, fontWeight:600 }}>No screenings yet</p><p style={{ margin:'6px 0 0', fontSize:14 }}>Tap "Screen" to begin</p></div>
      ) : (
        <div style={{ padding:'0 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {recent.map(s => (
            <div key={s.id} className="card card-padded" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:RISK_COLORS[s.riskLevel], flexShrink:0 }} />
              <div style={{ flex:1 }}><div style={{ fontWeight:600, fontSize:14 }}>{s.muacCm.toFixed(1)} cm</div><div style={{ fontSize:12, color:'var(--stone-400)' }}>{RISK_LABELS[s.riskLevel]}</div></div>
              <div style={{ fontSize:12, color:'var(--stone-400)' }}>{timeAgo(s.screenedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
