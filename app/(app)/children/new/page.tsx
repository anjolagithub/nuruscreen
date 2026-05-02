'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { saveChild } from '@/lib/db';
import type { Child, ClimateContext } from '@/types';
import { CLIMATE_LABELS } from '@/types';

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function RegisterChildPage() {
  const { worker } = useAuth(); const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', ageMonths:'', sex:'' as 'male'|'female'|'', village:'', lga:'', state:'Borno', climateContext:'none' as ClimateContext });
  const valid = form.name && form.ageMonths && form.sex && form.village;

  const handleSave = async () => {
    if (!valid || !worker) return; setSaving(true);
    const child: Child = { id:`child_${Date.now()}_${Math.random().toString(36).slice(2,9)}`, name:form.name.trim(), ageMonths:parseInt(form.ageMonths), sex:form.sex as 'male'|'female', village:form.village.trim(), lga:form.lga.trim(), state:form.state, climateContext:form.climateContext, createdAt:Date.now(), healthWorkerId:worker.id };
    await saveChild(child);
    router.push(`/children/${child.id}`);
  };

  return (
    <div>
      <div className="page-header">
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', padding:'0 0 12px', fontSize:14 }}>← Back</button>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Register Child</h1>
      </div>
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        <div><label className="form-label">Child's Name *</label><input className="form-input" type="text" placeholder="e.g. Fatima Ibrahim" value={form.name} onChange={e => setForm({...form, name:e.target.value})} autoFocus /></div>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}><label className="form-label">Age (months) *</label><input className="form-input" type="number" placeholder="e.g. 24" min={6} max={59} value={form.ageMonths} onChange={e => setForm({...form, ageMonths:e.target.value})} /></div>
          <div style={{ flex:1 }}><label className="form-label">Sex *</label><select className="form-input" value={form.sex} onChange={e => setForm({...form, sex:e.target.value as 'male'|'female'})}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></div>
        </div>
        <div><label className="form-label">Village *</label><input className="form-input" type="text" placeholder="e.g. Gwoza" value={form.village} onChange={e => setForm({...form, village:e.target.value})} /></div>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}><label className="form-label">LGA</label><input className="form-input" type="text" placeholder="LGA" value={form.lga} onChange={e => setForm({...form, lga:e.target.value})} /></div>
          <div style={{ flex:1 }}><label className="form-label">State</label><select className="form-input" value={form.state} onChange={e => setForm({...form, state:e.target.value})}>{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div>
          <label className="form-label">Climate Context</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
            {(Object.keys(CLIMATE_LABELS) as ClimateContext[]).map(ctx => (
              <button key={ctx} onClick={() => setForm({...form, climateContext:ctx})} style={{ padding:'8px 14px', borderRadius:10, border:'1.5px solid', borderColor: form.climateContext === ctx ? 'var(--forest)' : 'var(--stone-200)', background: form.climateContext === ctx ? 'var(--forest)' : 'white', color: form.climateContext === ctx ? 'white' : 'var(--stone-600)', fontSize:13, fontWeight:500, cursor:'pointer' }}>{CLIMATE_LABELS[ctx]}</button>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={!valid || saving}>{saving ? <div className="spinner" /> : '✓ Save & Screen Child'}</button>
      </div>
    </div>
  );
}
