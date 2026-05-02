'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { HealthWorker } from '@/types';

export default function LoginPage() {
  const { login } = useAuth();
  const [step, setStep] = useState<'welcome'|'form'>('welcome');
  const [form, setForm] = useState({ name:'', facility:'', phone:'' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.facility) return;
    setLoading(true);
    await login({ id:`hw_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, name:form.name.trim(), facility:form.facility.trim(), phone:form.phone.trim() });
  };

  if (step === 'welcome') return (
    <div className="app-shell" style={{ background:'var(--forest)', position:'relative', overflow:'hidden' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', textAlign:'center', color:'white', position:'relative', zIndex:1 }}>
        <div style={{ width:88, height:88, borderRadius:24, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, marginBottom:32, border:'1px solid rgba(255,255,255,0.2)' }}>🫀</div>
        <h1 style={{ fontSize:34, fontWeight:700, margin:'0 0 12px', letterSpacing:'-0.02em' }}>NuruScreen</h1>
        <p style={{ fontSize:17, opacity:0.85, lineHeight:1.6, margin:'0 0 16px' }}>AI-powered malnutrition screening for community health workers</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:48 }}>
          {['Works offline','No equipment','WHO standards'].map(tag => <span key={tag} style={{ fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:999, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)' }}>{tag}</span>)}
        </div>
        <button className="btn-primary" style={{ background:'white', color:'var(--forest)', maxWidth:300 }} onClick={() => setStep('form')}>Get Started</button>
        <p style={{ marginTop:16, fontSize:13, opacity:0.6 }}>Your data stays on this device</p>
      </div>
      <div style={{ position:'absolute', top:-80, right:-80, width:260, height:260, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-40, left:-60, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
    </div>
  );

  return (
    <div className="app-shell">
      <div className="page-header">
        <button onClick={() => setStep('welcome')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', padding:'0 0 12px', fontSize:14 }}>← Back</button>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Your Details</h1>
        <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>This identifies you as the health worker</p>
      </div>
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        <div><label className="form-label">Full Name *</label><input className="form-input" type="text" placeholder="e.g. Amaka Okafor" value={form.name} onChange={e => setForm({...form, name:e.target.value})} autoFocus /></div>
        <div><label className="form-label">Health Facility *</label><input className="form-input" type="text" placeholder="e.g. Borno PHC, Maiduguri" value={form.facility} onChange={e => setForm({...form, facility:e.target.value})} /></div>
        <div><label className="form-label">Phone (optional)</label><input className="form-input" type="tel" placeholder="e.g. 08012345678" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></div>
        <button className="btn-primary" onClick={handleSubmit} disabled={!form.name || !form.facility || loading}>{loading ? <div className="spinner" /> : 'Start Screening →'}</button>
        <p style={{ fontSize:13, color:'var(--stone-400)', textAlign:'center' }}>No account needed. Data stays on device.</p>
      </div>
    </div>
  );
}
