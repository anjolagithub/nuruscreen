'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getRecentScreenings, getChild } from '@/lib/db';
import type { Screening, Child } from '@/types';
import { RISK_LABELS, RISK_COLORS } from '@/types';

type SW = Screening & { child?: Child };

export default function HistoryPage() {
  const { worker } = useAuth(); const router = useRouter();
  const [items, setItems] = useState<SW[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!worker) return;
    getRecentScreenings(worker.id, 50).then(async ss => {
      setItems(await Promise.all(ss.map(async s => ({ ...s, child: await getChild(s.childId) }))));
      setLoading(false);
    });
  }, [worker]);
  return (
    <div>
      <div className="page-header"><h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>History</h1><p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>All screenings on this device</p></div>
      {loading ? <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner" style={{ borderTopColor:'var(--forest)', borderColor:'var(--stone-200)' }} /></div>
      : items.length === 0 ? <div className="empty-state"><div style={{ fontSize:40, marginBottom:12 }}>📋</div><p style={{ margin:0, fontWeight:600 }}>No screenings yet</p><button className="btn-primary" onClick={() => router.push('/screen')} style={{ marginTop:16, maxWidth:220 }}>Start First Screening</button></div>
      : <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {items.map(s => (
            <div key={s.id} className="card card-padded" style={{ cursor:'pointer' }} onClick={() => s.child && router.push(`/children/${s.child.id}`)}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background: s.riskLevel==='green' ? 'var(--risk-green-bg)' : s.riskLevel==='yellow' ? 'var(--risk-yellow-bg)' : 'var(--risk-red-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:700, color:RISK_COLORS[s.riskLevel], fontFamily:'var(--font-mono)' }}>{s.muacCm.toFixed(0)}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:15 }}>{s.child?.name ?? 'Unknown'}</div>
                  <div style={{ fontSize:12, color:'var(--stone-400)', marginTop:1 }}>{s.muacCm.toFixed(1)} cm · {RISK_LABELS[s.riskLevel]}</div>
                  <div style={{ fontSize:11, color:'var(--stone-400)', marginTop:1 }}>{new Date(s.screenedAt).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</div>
                </div>
                <div style={{ padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:700, background: s.riskLevel==='green' ? 'var(--risk-green-bg)' : s.riskLevel==='yellow' ? 'var(--risk-yellow-bg)' : 'var(--risk-red-bg)', color:RISK_COLORS[s.riskLevel] }}>{s.riskLevel.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}
