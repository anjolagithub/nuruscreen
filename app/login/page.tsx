'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'welcome'|'form'>('welcome');
  const [name, setName] = useState('');
  const [facility, setFacility] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !facility.trim()) return;
    setLoading(true);

    const worker = {
      id:       `hw_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name:     name.trim(),
      facility: facility.trim(),
      phone:    phone.trim(),
    };

    // Save to localStorage
    localStorage.setItem('nuruscreen_worker_data', JSON.stringify(worker));
    localStorage.setItem('nuruscreen_worker_id', worker.id);

    // Hard redirect — bypasses any auth guard middleware loop
    window.location.href = '/dashboard';
  };

  if (step === 'welcome') return (
    <div style={{ minHeight:'100dvh', background:'var(--forest)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', textAlign:'center', color:'white' }}>
      <div style={{ fontSize:60, marginBottom:24 }}>🫀</div>
      <h1 style={{ fontSize:34, fontWeight:700, margin:'0 0 12px' }}>NuruScreen</h1>
      <p style={{ fontSize:17, opacity:0.85, margin:'0 0 48px' }}>AI malnutrition screening for health workers</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:48 }}>
        {['Works offline','No equipment','WHO standards'].map(t => (
          <span key={t} style={{ fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:999, background:'rgba(255,255,255,0.15)' }}>{t}</span>
        ))}
      </div>
      <button
        onClick={() => setStep('form')}
        style={{ width:'100%', maxWidth:300, padding:'16px', background:'white', color:'var(--forest)', border:'none', borderRadius:12, fontSize:16, fontWeight:700, cursor:'pointer' }}
      >
        Get Started
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:'100dvh', background:'white' }}>
      <div style={{ background:'var(--forest)', color:'white', padding:'20px 20px 16px' }}>
        <button onClick={() => setStep('welcome')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', padding:'0 0 12px', fontSize:14 }}>← Back</button>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Your Details</h1>
        <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>This identifies you as the health worker</p>
      </div>
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--stone-600)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Full Name *</label>
          <input
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid var(--stone-200)', fontSize:16, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            type="text"
            placeholder="e.g. Amaka Okafor"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--stone-600)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Health Facility *</label>
          <input
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid var(--stone-200)', fontSize:16, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            type="text"
            placeholder="e.g. Borno PHC"
            value={facility}
            onChange={e => setFacility(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--stone-600)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Phone (optional)</label>
          <input
            style={{ width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid var(--stone-200)', fontSize:16, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            type="tel"
            placeholder="e.g. 08012345678"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !facility.trim() || loading}
          style={{
            width:'100%', padding:'16px',
            background: (!name.trim() || !facility.trim() || loading) ? 'var(--stone-200)' : 'var(--forest)',
            color:      (!name.trim() || !facility.trim() || loading) ? 'var(--stone-400)' : 'white',
            border:'none', borderRadius:12, fontSize:16, fontWeight:700,
            cursor: (!name.trim() || !facility.trim() || loading) ? 'not-allowed' : 'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}
        >
          {loading
            ? <><div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> Setting up...</>
            : 'Start Screening →'
          }
        </button>
        <p style={{ fontSize:13, color:'var(--stone-400)', textAlign:'center' }}>No account needed. Data stays on device.</p>
      </div>
    </div>
  );
}