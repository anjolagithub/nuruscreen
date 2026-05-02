'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getChildren } from '@/lib/db';
import type { Child } from '@/types';
import { CLIMATE_LABELS } from '@/types';

export default function ChildrenPage() {
  const { worker } = useAuth(); const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => { if (worker) getChildren(worker.id).then(setChildren); }, [worker]);
  const filtered = children.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.village.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Children</h1>
          <button className="btn-primary" onClick={() => router.push('/children/new')} style={{ width:'auto', padding:'8px 14px', fontSize:14, borderRadius:10 }}>+ Add</button>
        </div>
        <input className="form-input" type="search" placeholder="Search by name or village..." value={search} onChange={e => setSearch(e.target.value)} style={{ background:'rgba(255,255,255,0.15)', color:'white', borderColor:'rgba(255,255,255,0.2)' }} />
      </div>
      <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.length === 0 ? (
          <div className="empty-state"><div style={{ fontSize:40, marginBottom:12 }}>👶</div><p style={{ margin:0, fontWeight:600 }}>{search ? 'No results' : 'No children registered'}</p>{!search && <button className="btn-primary" onClick={() => router.push('/children/new')} style={{ marginTop:16, maxWidth:220 }}>Register First Child</button>}</div>
        ) : filtered.map(child => (
          <button key={child.id} onClick={() => router.push(`/children/${child.id}`)} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'white', border:'1.5px solid var(--stone-200)', borderRadius:14, cursor:'pointer', textAlign:'left', width:'100%' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background: child.sex === 'female' ? '#fce7f3' : '#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{child.sex === 'female' ? '👧' : '👦'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:15 }}>{child.name}</div>
              <div style={{ fontSize:12, color:'var(--stone-400)', marginTop:2 }}>{child.ageMonths} months · {child.village}, {child.state}</div>
              {child.climateContext !== 'none' && <div style={{ display:'inline-block', marginTop:6, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:999, background:'#fef3c7', color:'#d97706' }}>{CLIMATE_LABELS[child.climateContext]}</div>}
            </div>
            <span style={{ color:'var(--stone-300)', fontSize:18 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
