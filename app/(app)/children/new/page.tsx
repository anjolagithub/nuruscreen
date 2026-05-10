'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { saveChild } from '@/lib/db';
import type { Child, ClimateContext, ClimateContexts } from '@/types';
import { CLIMATE_LABELS } from '@/types';

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa',
  'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun',
  'Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

// Climate options — 'none' is mutually exclusive with the others
const CLIMATE_OPTIONS = Object.keys(CLIMATE_LABELS) as ClimateContext[];

export default function RegisterChildPage() {
  const { worker } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', ageMonths: '', sex: '' as 'male'|'female'|'',
    village: '', lga: '', state: 'Borno',
  });
  // Multi-select climate contexts — starts empty
  const [selectedContexts, setSelectedContexts] = useState<ClimateContexts>([]);

  const valid = form.name && form.ageMonths && form.sex && form.village;

  // Toggle a climate context on/off
  const toggleContext = (ctx: ClimateContext) => {
    if (ctx === 'none') {
      // 'None' clears all others and selects only itself
      setSelectedContexts(selectedContexts.includes('none') ? [] : ['none']);
      return;
    }
    // Any real context removes 'none' and toggles itself
    setSelectedContexts(prev => {
      const withoutNone = prev.filter(c => c !== 'none');
      if (withoutNone.includes(ctx)) {
        return withoutNone.filter(c => c !== ctx);
      }
      return [...withoutNone, ctx];
    });
  };

  const isSelected = (ctx: ClimateContext) => selectedContexts.includes(ctx);

  const handleSave = async () => {
    if (!valid || !worker) return;
    setSaving(true);
    const child: Child = {
      id:              `child_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
      name:            form.name.trim(),
      ageMonths:       parseInt(form.ageMonths),
      sex:             form.sex as 'male'|'female',
      village:         form.village.trim(),
      lga:             form.lga.trim(),
      state:           form.state,
      climateContexts: selectedContexts.length > 0 ? selectedContexts : ['none'],
      createdAt:       Date.now(),
      healthWorkerId:  worker.id,
    };
    await saveChild(child);
    router.push(`/children/${child.id}`);
  };

  return (
    <div>
      <div className="page-header">
        <button
          onClick={() => router.back()}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', padding:'0 0 12px', fontSize:14 }}
        >
          ← Back
        </button>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Register Child</h1>
      </div>

      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Name */}
        <div>
          <label className="form-label">Child's Name *</label>
          <input className="form-input" type="text" placeholder="e.g. Fatima Ibrahim"
            value={form.name} onChange={e => setForm({...form, name:e.target.value})} autoFocus />
        </div>

        {/* Age + Sex */}
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}>
            <label className="form-label">Age (months) *</label>
            <input className="form-input" type="number" placeholder="e.g. 24" min={6} max={59}
              value={form.ageMonths} onChange={e => setForm({...form, ageMonths:e.target.value})} />
          </div>
          <div style={{ flex:1 }}>
            <label className="form-label">Sex *</label>
            <select className="form-input" value={form.sex} onChange={e => setForm({...form, sex:e.target.value as 'male'|'female'})}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        {/* Village */}
        <div>
          <label className="form-label">Village *</label>
          <input className="form-input" type="text" placeholder="e.g. Gwoza"
            value={form.village} onChange={e => setForm({...form, village:e.target.value})} />
        </div>

        {/* LGA + State */}
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}>
            <label className="form-label">LGA</label>
            <input className="form-input" type="text" placeholder="LGA"
              value={form.lga} onChange={e => setForm({...form, lga:e.target.value})} />
          </div>
          <div style={{ flex:1 }}>
            <label className="form-label">State</label>
            <select className="form-input" value={form.state} onChange={e => setForm({...form, state:e.target.value})}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* ── MULTI-SELECT CLIMATE CONTEXT ── */}
        <div>
          <label className="form-label">
            Climate Context
            <span style={{ fontWeight:400, textTransform:'none', marginLeft:6, fontSize:11, color:'var(--stone-400)' }}>
              Select all that apply
            </span>
          </label>

          {/* Selection summary */}
          {selectedContexts.length > 0 && !selectedContexts.includes('none') && (
            <div style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'8px 12px', marginBottom:10,
              background:'#f0fdf4', border:'1px solid #86efac',
              borderRadius:8, fontSize:12, color:'#14532d',
            }}>
              <span style={{ fontWeight:700 }}>Selected:</span>
              <span>{selectedContexts.map(c => CLIMATE_LABELS[c]).join(' + ')}</span>
              <button
                onClick={() => setSelectedContexts([])}
                style={{ marginLeft:'auto', background:'none', border:'none', color:'#16a34a', cursor:'pointer', fontSize:12, fontWeight:600 }}
              >
                Clear
              </button>
            </div>
          )}

          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {CLIMATE_OPTIONS.map(ctx => {
              const selected = isSelected(ctx);
              const isNone = ctx === 'none';
              // Disable 'none' if any real context is selected, and vice versa
              const disabled = isNone
                ? selectedContexts.some(c => c !== 'none')
                : selectedContexts.includes('none');

              return (
                <button
                  key={ctx}
                  onClick={() => !disabled && toggleContext(ctx)}
                  style={{
                    padding:'10px 14px',
                    borderRadius:10,
                    border: selected ? '2px solid' : '1.5px solid',
                    borderColor: selected
                      ? (isNone ? 'var(--forest)' : '#d97706')
                      : 'var(--stone-200)',
                    background: selected
                      ? (isNone ? '#f0fdf4' : '#fef3c7')
                      : 'white',
                    color: selected
                      ? (isNone ? 'var(--forest)' : '#92400e')
                      : disabled ? 'var(--stone-300)' : 'var(--stone-600)',
                    fontSize: 13,
                    fontWeight: selected ? 600 : 500,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'all 0.12s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {selected && <span style={{ fontSize:11 }}>✓</span>}
                  {CLIMATE_LABELS[ctx]}
                </button>
              );
            })}
          </div>

          <p style={{ margin:'8px 0 0', fontSize:12, color:'var(--stone-400)', lineHeight:1.5 }}>
            A child may be affected by multiple climate events simultaneously.
            Select "No Climate Event" only if the child is in a stable area.
          </p>
        </div>

        {/* Save button */}
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!valid || saving}
          style={{ marginTop:4 }}
        >
          {saving ? <div className="spinner" /> : '✓ Save & Screen Child'}
        </button>
      </div>
    </div>
  );
}