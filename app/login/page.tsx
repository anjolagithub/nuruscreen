'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// MUAC Circle logo — authoritative, not emoji
function NuruLogo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="#0f4c35"/>
      <circle cx="32" cy="32" r="19" fill="none" stroke="white" strokeWidth="2.5"
        strokeDasharray="4.5 3" strokeLinecap="round"/>
      <line x1="32" y1="14" x2="32" y2="50" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <line x1="14" y1="32" x2="50" y2="32" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="32" cy="32" r="5" fill="#22c55e"/>
    </svg>
  );
}

const inputStyle = {
  width: '100%', padding: '14px 16px', borderRadius: 10,
  border: '2px solid #e7e5e4', fontSize: 17,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  background: '#fafaf9', color: '#1c1917',
};

export default function LoginPage() {
  const router  = useRouter();
  const [step, setStep]         = useState<'welcome'|'form'>('welcome');
  const [name, setName]         = useState('');
  const [facility, setFacility] = useState('');
  const [phone, setPhone]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || !facility.trim()) return;
    setLoading(true);
    const worker = {
      id:       `hw_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name:     name.trim(),
      facility: facility.trim(),
      phone:    phone.trim(),
    };
    localStorage.setItem('nuruscreen_worker_data', JSON.stringify(worker));
    localStorage.setItem('nuruscreen_worker_id', worker.id);
    window.location.href = '/dashboard';
  };

  // ── WELCOME SCREEN ──
  if (step === 'welcome') return (
    <div style={{
      minHeight: '100dvh', background: 'var(--forest)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 32px', textAlign: 'center', color: 'white',
    }}>
      {/* Logo — not emoji */}
      <NuruLogo size={80} />

      <h1 style={{ fontSize: 32, fontWeight: 700, margin: '20px 0 8px', letterSpacing: '-0.01em' }}>
        NuruScreen
      </h1>
      <p style={{ fontSize: 15, opacity: 0.8, margin: '0 0 8px', lineHeight: 1.5 }}>
        AI malnutrition screening
      </p>
      <p style={{ fontSize: 13, opacity: 0.55, margin: '0 0 40px' }}>
        for community health workers
      </p>

      {/* Feature pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 48 }}>
        {[
          { icon: '📶', label: 'Works offline' },
          { icon: '📏', label: 'No equipment' },
          { icon: '🏥', label: 'WHO standards' },
        ].map(({ icon, label }) => (
          <span key={label} style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px',
            borderRadius: 999, background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            {icon} {label}
          </span>
        ))}
      </div>

      {/* WHO classification reference — builds immediate clinical credibility */}
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: '16px 20px',
        marginBottom: 40, width: '100%', maxWidth: 320,
      }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>
          WHO MUAC Classification
        </p>
        {[
          { label: '✓  Well Nourished', range: '≥ 13.5 cm', color: '#4ade80' },
          { label: '⚠  Moderate (MAM)', range: '11.5 – 13.5 cm', color: '#fbbf24' },
          { label: '!  Urgent — SAM',   range: '< 11.5 cm',  color: '#f87171' },
        ].map(r => (
          <div key={r.label} style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '5px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: r.color }}>{r.label}</span>
            <span style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.7 }}>{r.range}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setStep('form')}
        style={{
          width: '100%', maxWidth: 300, padding: '18px',
          background: 'white', color: 'var(--forest)',
          border: 'none', borderRadius: 10, fontSize: 17,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Get Started →
      </button>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.45 }}>
        No account needed · Data stays on device
      </p>
    </div>
  );

  // ── FORM SCREEN ──
  return (
    <div style={{ minHeight: '100dvh', background: 'white' }}>
      <div style={{ background: 'var(--forest)', color: 'white', padding: '20px 20px 20px' }}>
        <button
          onClick={() => setStep('welcome')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', padding: '0 0 12px', fontSize: 14, fontFamily: 'inherit' }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Your Details</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 14 }}>
          Identifies you as the health worker on file
        </p>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#57534e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Full Name *
          </label>
          <input
            style={inputStyle} type="text"
            placeholder="e.g. Amaka Okafor"
            value={name} onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#57534e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Health Facility *
          </label>
          <input
            style={inputStyle} type="text"
            placeholder="e.g. Borno State PHC"
            value={facility} onChange={e => setFacility(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#57534e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Phone <span style={{ fontWeight: 500, textTransform: 'none', opacity: 0.6 }}>(optional)</span>
          </label>
          <input
            style={inputStyle} type="tel"
            placeholder="e.g. 08012345678"
            value={phone} onChange={e => setPhone(e.target.value)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !facility.trim() || loading}
          style={{
            width: '100%', padding: '18px',
            background: (!name.trim() || !facility.trim() || loading) ? '#e7e5e4' : 'var(--forest)',
            color: (!name.trim() || !facility.trim() || loading) ? '#a8a29e' : 'white',
            border: 'none', borderRadius: 10, fontSize: 17, fontWeight: 700,
            cursor: (!name.trim() || !facility.trim() || loading) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: 'inherit', minHeight: 58, marginTop: 4,
          }}
        >
          {loading
            ? <><div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/> Setting up...</>
            : 'Start Screening →'
          }
        </button>

        <p style={{ fontSize: 13, color: '#a8a29e', textAlign: 'center', lineHeight: 1.5 }}>
          No account needed.<br/>All data stays on your device.
        </p>
      </div>
    </div>
  );
}