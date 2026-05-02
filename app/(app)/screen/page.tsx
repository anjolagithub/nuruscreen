'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getChildren, saveScreening } from '@/lib/db';
import { MUACReadingBuffer, estimateMUACFromLandmarks } from '@/lib/muac';
import { RISK_LABELS, RISK_COLORS, classifyMUAC, type Child, type Screening, type RiskLevel } from '@/types';

type Phase = 'select-child'|'loading-model'|'guide'|'scanning'|'stable'|'result'|'saved';

function ScreenInner() {
  const { worker } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const poseRef = useRef<any>(null);
  const bufferRef = useRef(new MUACReadingBuffer(12));
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('select-child');

  const [phase, setPhase] = useState<Phase>('select-child');
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child|null>(null);
  const [liveValue, setLiveValue] = useState<number|null>(null);
  const [stableValue, setStableValue] = useState<number|null>(null);
  const [armDetected, setArmDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [modelError, setModelError] = useState<string|null>(null);

  const sp = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => { if (worker) getChildren(worker.id).then(setChildren); }, [worker]);

  useEffect(() => {
    const id = searchParams.get('child');
    if (id && children.length > 0) {
      const c = children.find(x => x.id === id);
      if (c) { setSelectedChild(c); sp('loading-model'); }
    }
  }, [searchParams, children]);

  useEffect(() => {
    if (phase !== 'loading-model') return;
    loadMediaPipe();
    return cleanup;
  }, [phase]);

  const cleanup = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const loadMediaPipe = async () => {
    try {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      );

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      poseRef.current = poseLandmarker;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (camErr: any) {
        console.error('Camera error:', camErr.name, camErr.message);
        setModelError(`Camera error: ${camErr.name} - ${camErr.message}`);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play().then(() => {
            console.log('Camera started OK, moving to guide');
            sp('guide');
          }).catch(err => {
            console.error('Play failed:', err);
            setModelError('Camera play failed: ' + err.message);
          });
        };
      }
    } catch (err: any) {
      console.error('MediaPipe error:', err);
      setModelError(err?.message ?? 'Model failed to load');
    }
  };

  const onPoseResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    if (!results.poseLandmarks) { setArmDetected(false); return; }
    const est = estimateMUACFromLandmarks(results.poseLandmarks, canvas.width, canvas.height);
    setArmDetected(est.armDetected);
    setConfidence(est.confidence);
    if (est.muacCm !== null && est.confidence > 0.6) {
      bufferRef.current.add(est.muacCm);
      const sm = bufferRef.current.getSmoothed();
      if (sm !== null) {
        setLiveValue(sm);
        if (est.armDetected && est.side) {
          const lms = results.poseLandmarks;
          const s = est.side;
          const eI = s==='left'?13:14, wI = s==='left'?15:16, shI = s==='left'?11:12;
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(lms[shI].x*canvas.width, lms[shI].y*canvas.height);
          ctx.lineTo(lms[eI].x*canvas.width, lms[eI].y*canvas.height);
          ctx.lineTo(lms[wI].x*canvas.width, lms[wI].y*canvas.height);
          ctx.stroke();
          const mx = ((lms[shI].x+lms[eI].x)/2)*canvas.width;
          const my = ((lms[shI].y+lms[eI].y)/2)*canvas.height;
          ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(34,197,94,0.3)'; ctx.fill();
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.stroke();
        }
        if (bufferRef.current.isStable() && phaseRef.current === 'scanning') {
          setStableValue(sm);
          sp('stable');
        }
      }
    }
  }, []);

  const processFrame = useCallback(() => {
    if (!videoRef.current || !poseRef.current) return;
    if (videoRef.current.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    const results = poseRef.current.detectForVideo(videoRef.current, performance.now());
    if (results.landmarks && results.landmarks[0]) {
      onPoseResults({ poseLandmarks: results.landmarks[0] });
    } else {
      setArmDetected(false);
    }
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [onPoseResults]);

  const startScanning = () => {
    sp('scanning');
    bufferRef.current.reset();
    processFrame();
  };

  const handleSave = async () => {
    if (!selectedChild || !worker || stableValue === null) return;
    setSaving(true);
    const s: Screening = {
      id: `scr_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
      childId: selectedChild.id,
      muacCm: parseFloat(stableValue.toFixed(1)),
      riskLevel: classifyMUAC(stableValue),
      notes: notes.trim(),
      screenedAt: Date.now(),
      healthWorkerId: worker.id,
      synced: false,
    };
    await saveScreening(s);
    sp('saved');
  };

  const rl: RiskLevel = stableValue !== null ? classifyMUAC(stableValue) : 'unknown';

  if (phase === 'select-child') return (
    <div>
      <div className="page-header">
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Screen Child</h1>
        <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>Select child to screen</p>
      </div>
      <div style={{ padding:'16px 20px' }}>
        <button className="btn-primary" onClick={() => router.push('/children/new')} style={{ marginBottom:20 }}>+ Register New Child</button>
        {children.length === 0
          ? <div className="empty-state"><div style={{ fontSize:40, marginBottom:12 }}>👶</div><p style={{ margin:0, fontWeight:600 }}>No children registered yet</p></div>
          : children.map(child => (
            <button key={child.id} onClick={() => { setSelectedChild(child); sp('loading-model'); }}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'white', border:'1.5px solid var(--stone-200)', borderRadius:12, cursor:'pointer', textAlign:'left', width:'100%', marginBottom:8 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background: child.sex==='female'?'#fce7f3':'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                {child.sex==='female'?'👧':'👦'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:15 }}>{child.name}</div>
                <div style={{ fontSize:13, color:'var(--stone-400)' }}>{child.ageMonths} months · {child.village}</div>
              </div>
              <span style={{ color:'var(--stone-400)' }}>›</span>
            </button>
          ))
        }
      </div>
    </div>
  );

  if (phase === 'loading-model') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', gap:16, background:'var(--forest)', color:'white' }}>
      <div className="spinner" />
      <p style={{ margin:0, fontWeight:600 }}>Loading AI model...</p>
      <p style={{ margin:0, fontSize:13, opacity:0.7 }}>First use takes a moment</p>
      {modelError && (
        <div style={{ background:'rgba(220,38,38,0.2)', padding:'12px 20px', borderRadius:10, maxWidth:300, textAlign:'center' }}>
          <p style={{ margin:0, fontSize:14 }}>{modelError}</p>
          <button className="btn-secondary" onClick={() => router.back()} style={{ marginTop:12 }}>Go Back</button>
        </div>
      )}
    </div>
  );

  if (phase === 'guide') return (
    <div style={{ background:'#000', minHeight:'100dvh', color:'white', display:'flex', flexDirection:'column', position:'relative' }}>
      <video ref={videoRef} style={{ position:'absolute', opacity:0.3, width:'100%', height:'100%', objectFit:'cover' }} playsInline muted />
      <div style={{ position:'relative', zIndex:10, flex:1, display:'flex', flexDirection:'column', padding:24, justifyContent:'space-between' }}>
        <div>
          <p style={{ margin:'0 0 4px', opacity:0.7, fontSize:13 }}>Screening</p>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>{selectedChild?.name}</h2>
        </div>
        <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:20, padding:24, backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.15)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:18, fontWeight:700 }}>How to position</h3>
          {['📏 Extend your arm straight out','📱 Hold phone 40-60cm away','💡 Ensure good lighting','🎯 Show full arm: shoulder to wrist'].map((s,i) => (
            <div key={i} style={{ fontSize:14, lineHeight:1.6, marginBottom:8 }}>{s}</div>
          ))}
        </div>
        <button className="btn-primary" onClick={startScanning}>Start Scanning →</button>
      </div>
    </div>
  );

  if (phase === 'scanning' || phase === 'stable') return (
    <div style={{ background:'#000', minHeight:'100dvh', position:'relative', overflow:'hidden' }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
      <video ref={videoRef} style={{ display:'none' }} playsInline muted />
      <div style={{ position:'absolute', top:0, left:0, right:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)', padding:'20px 20px 40px', color:'white', zIndex:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ margin:0, fontWeight:600 }}>{armDetected ? '✅ Arm detected' : '🔍 Looking for arm...'}</p>
          <div style={{ background: armDetected?'rgba(34,197,94,0.3)':'rgba(255,255,255,0.15)', border:`1px solid ${armDetected?'#22c55e':'rgba(255,255,255,0.3)'}`, borderRadius:20, padding:'6px 14px', fontSize:13, fontWeight:600 }}>
            {Math.round(confidence*100)}%
          </div>
        </div>
      </div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding:'48px 24px 40px', color:'white', zIndex:20 }}>
        {liveValue !== null && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div className="muac-number" style={{ color:'white', fontSize:56 }}>
              {liveValue.toFixed(1)}<span style={{ fontSize:24, opacity:0.7, marginLeft:4 }}>cm</span>
            </div>
            <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:13 }}>
              {bufferRef.current.isStable() ? '✅ Reading stable' : 'Hold steady...'}
            </p>
          </div>
        )}
        {phase === 'stable' && (
          <button className="btn-primary" onClick={() => { sp('result'); cleanup(); }}>
            ✓ Confirm — {stableValue?.toFixed(1)} cm
          </button>
        )}
        {phase === 'scanning' && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:14, background:'rgba(255,255,255,0.1)', borderRadius:12 }}>
            <div className="spinner" style={{ width:18, height:18, borderWidth:2 }} />
            <span style={{ fontSize:14 }}>Analysing arm position...</span>
          </div>
        )}
      </div>
    </div>
  );

  if (phase === 'result') return (
    <div>
      <div className="page-header">
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Result</h1>
        <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>{selectedChild?.name}</p>
      </div>
      <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:16 }}>
        <div className={`result-banner ${rl}`}>
          <div className="muac-number" style={{ color:RISK_COLORS[rl] }}>{stableValue?.toFixed(1)} cm</div>
          <p style={{ margin:'8px 0 4px', fontSize:18, fontWeight:700, color:RISK_COLORS[rl] }}>{RISK_LABELS[rl]}</p>
          <p style={{ margin:0, fontSize:13, color:'var(--stone-600)' }}>WHO MUAC classification</p>
        </div>
        <div className="card card-padded">
          <p className="form-label" style={{ marginBottom:10 }}>Recommended Action</p>
          {rl === 'green' && <p style={{ margin:0, fontSize:14, lineHeight:1.6 }}>Child is well nourished. Schedule next screening in 3 months.</p>}
          {rl === 'yellow' && <p style={{ margin:0, fontSize:14, lineHeight:1.6, color:'var(--risk-yellow)' }}>⚠️ Moderate acute malnutrition. Enrol in supplementary feeding. Re-screen in 4 weeks.</p>}
          {rl === 'red' && <p style={{ margin:0, fontSize:14, lineHeight:1.6, color:'var(--risk-red)' }}>🚨 Severe acute malnutrition. Refer immediately to therapeutic feeding centre.</p>}
        </div>
        <div>
          <label className="form-label">Notes (optional)</label>
          <textarea className="form-input" rows={3} placeholder="Observations..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize:'none' }} />
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <div className="spinner" /> : '💾 Save Record'}
        </button>
        <button className="btn-secondary" onClick={() => { sp('scanning'); processFrame(); }}>Retake Reading</button>
      </div>
    </div>
  );

  if (phase === 'saved') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', padding:32, textAlign:'center' }}>
      <div style={{ width:80, height:80, borderRadius:'50%', background:'var(--risk-green-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, marginBottom:24 }}>✅</div>
      <h2 style={{ margin:'0 0 8px', fontSize:24, fontWeight:700 }}>Saved</h2>
      <p style={{ margin:'0 0 32px', color:'var(--stone-600)', lineHeight:1.6 }}>
        Record for <strong>{selectedChild?.name}</strong> saved to device.
      </p>
      <button className="btn-primary" style={{ maxWidth:280 }} onClick={() => {
        sp('select-child');
        setSelectedChild(null);
        setLiveValue(null);
        setStableValue(null);
        setNotes('');
        bufferRef.current.reset();
      }}>Screen Another Child</button>
      <button className="btn-secondary" style={{ maxWidth:280, marginTop:10 }} onClick={() => router.push('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
  );

  return null;
}

export default function ScreenPage()  { return <Suspense><ScreenInner /></Suspense>; }
