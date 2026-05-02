'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getChild, getScreeningsForChild } from '@/lib/db';
import type { Child, Screening } from '@/types';
import { RISK_LABELS, RISK_COLORS, CLIMATE_LABELS } from '@/types';

function timeAgo(ts: number) { const d = Math.floor((Date.now()-ts)/86400000); return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`; }

export default function ChildDetailPage() {
  const router = useRouter(); const params = useParams();
  const [child, setChild] = useState<Child | null>(null);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  useEffect(() => { const id = params.id as string; getChild(id).then(setChild); getScreeningsForChild(id).then(setScreenings); }, [params.id]);
  if (!child) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh' }}><div className="spinner" style={{ borderTopColor:'var(--forest)', borderColor:'var(--stone-200)' }} /></div>;
  const last = screenings[0]; const rl = last?.riskLevel;
  return (
    <div>
      <div className="page-header">
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', padding:'0 0 12px', fontSize:14 }}>← Back</button>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background: child.sex === 'female' ? '#fce7f3' : '#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>{child.sex === 'female' ? '👧' : '👦'}</div>
          <div><h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>{child.name}</h1><p style={{ margin:'2px 0 0', opacity:0.7, fontSize:14 }}>{child.ageMonths} months · {child.sex} · {child.village}</p></div>
        </div>
      </div>
      <div style={{ padding:'20px 20px 0', display:'flex', flexDirection:'column', gap:14 }}>
        {last && rl && (
          <div style={{ padding:20, borderRadius:16, background: rl === 'green' ? 'var(--risk-green-bg)' : rl === 'yellow' ? 'var(--risk-yellow-bg)' : 'var(--risk-red-bg)', border:`1.5px solid ${RISK_COLORS[rl]}` }}>
            <p style={{ margin:'0 0 4px', fontSize:12, fontWeight:700, textTransform:'uppercase', color:RISK_COLORS[rl] }}>Latest Reading</p>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <span className="muac-number" style={{ color:RISK_COLORS[rl], fontSize:40 }}>{last.muacCm.toFixed(1)}</span>
              <span style={{ fontSize:16, color:RISK_COLORS[rl], opacity:0.8 }}>cm</span>
            </div>
            <p style={{ margin:'4px 0 0', fontWeight:600, color:RISK_COLORS[rl] }}>{RISK_LABELS[rl]}</p>
            <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--stone-600)' }}>{timeAgo(last.screenedAt)}</p>
          </div>
        )}
        <div className="card card-padded">
          <p className="form-label" style={{ marginBottom:12 }}>Child Details</p>
          {[['Village',child.village],['LGA',child.lga||'—'],['State',child.state],['Climate',CLIMATE_LABELS[child.climateContext]]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:14, marginBottom:8 }}><span style={{ color:'var(--stone-400)' }}>{l}</span><span style={{ fontWeight:500 }}>{v}</span></div>
          ))}
        </div>
        <button className="btn-primary" onClick={() => router.push(`/screen?child=${child.id}`)}>📷 Screen Now</button>
      </div>
      <p className="section-title" style={{ marginTop:20 }}>Screening History ({screenings.length})</p>
      {screenings.length === 0 ? <div className="empty-state"><p style={{ margin:0, fontSize:14 }}>No screenings yet</p></div> : (
        <div style={{ padding:'0 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {screenings.map(s => (
            <div key={s.id} className="card card-padded" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background: s.riskLevel === 'green' ? 'var(--risk-green-bg)' : s.riskLevel === 'yellow' ? 'var(--risk-yellow-bg)' : 'var(--risk-red-bg)', display:'flex', alignItems:'center', justifyContent:'center', color:RISK_COLORS[s.riskLevel], fontWeight:700, flexShrink:0 }}>●</div>
              <div style={{ flex:1 }}><div style={{ display:'flex', alignItems:'baseline', gap:6 }}><span style={{ fontWeight:700, fontSize:16 }}>{s.muacCm.toFixed(1)} cm</span><span style={{ fontSize:12, color:RISK_COLORS[s.riskLevel], fontWeight:600 }}>{s.riskLevel.toUpperCase()}</span></div><div style={{ fontSize:12, color:'var(--stone-400)' }}>{timeAgo(s.screenedAt)}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
