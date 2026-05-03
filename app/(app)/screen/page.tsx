'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getChildren, saveScreening } from '@/lib/db';
import { MUACReadingBuffer, estimateMUACFromLandmarks } from '@/lib/muac';
import { RISK_LABELS, RISK_COLORS, classifyMUAC, type Child, type Screening, type RiskLevel } from '@/types';

type Phase = 'select-child'|'loading-model'|'guide'|'scanning'|'stable'|'result'|'saved';

function getWorker() {
  try { return JSON.parse(localStorage.getItem('nuruscreen_worker_data') || 'null'); } catch { return null; }
}

function ScreenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // These refs never change — they always point to the same DOM elements
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream|null>(null);
  const poseRef      = useRef<any>(null);
  const bufferRef    = useRef(new MUACReadingBuffer(12));
  const animFrameRef = useRef<number>(0);
  const phaseRef     = useRef<Phase>('select-child');
  const isRunningRef = useRef(false);

  const [phase, setPhase]               = useState<Phase>('select-child');
  const [children, setChildren]         = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child|null>(null);
  const [liveValue, setLiveValue]       = useState<number|null>(null);
  const [stableValue, setStableValue]   = useState<number|null>(null);
  const [armDetected, setArmDetected]   = useState(false);
  const [confidence, setConfidence]     = useState(0);
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [modelError, setModelError]     = useState<string|null>(null);

  const sp = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const stopLoop = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Clear video srcObject
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopLoop]);

  useEffect(() => {
    const worker = getWorker();
    if (!worker) { router.replace('/login'); return; }
    getChildren(worker.id).then(setChildren);
    // Stop camera on unmount
    return stopCamera;
  }, [router, stopCamera]);

  useEffect(() => {
    const id = searchParams.get('child');
    if (id && children.length > 0) {
      const c = children.find(x => x.id === id);
      if (c) { setSelectedChild(c); sp('loading-model'); }
    }
  }, [searchParams, children, sp]);

  useEffect(() => {
    if (phase === 'loading-model') {
      loadMediaPipe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── Pose results: draw landmarks on canvas only (video IS the background) ───
  const onPoseResults = useCallback((landmarks: any[]) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    // Size canvas to match video — critical for correct landmark positioning
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const est = estimateMUACFromLandmarks(landmarks, canvas.width, canvas.height);
    setArmDetected(est.armDetected);
    setConfidence(est.confidence);

    if (est.muacCm !== null && est.confidence > 0.6) {
      bufferRef.current.add(est.muacCm);
      const sm = bufferRef.current.getSmoothed();
      if (sm !== null) {
        setLiveValue(sm);

        // Draw arm skeleton overlay
        if (est.armDetected && est.side) {
          const s   = est.side;
          const eI  = s==='left'?13:14, wI = s==='left'?15:16, shI = s==='left'?11:12;
          const lm  = (i: number) => ({
            x: landmarks[i].x * canvas.width,
            y: landmarks[i].y * canvas.height,
          });

          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth   = 5;
          ctx.lineCap     = 'round';
          ctx.lineJoin    = 'round';
          ctx.beginPath();
          ctx.moveTo(lm(shI).x, lm(shI).y);
          ctx.lineTo(lm(eI).x,  lm(eI).y);
          ctx.lineTo(lm(wI).x,  lm(wI).y);
          ctx.stroke();

          // Midpoint circle (MUAC measurement point)
          const mx = (lm(shI).x + lm(eI).x) / 2;
          const my = (lm(shI).y + lm(eI).y) / 2;
          ctx.beginPath();
          ctx.arc(mx, my, 14, 0, Math.PI * 2);
          ctx.fillStyle   = 'rgba(34,197,94,0.25)';
          ctx.fill();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth   = 3;
          ctx.stroke();

          // Dots on joints
          [shI, eI, wI].forEach(i => {
            ctx.beginPath();
            ctx.arc(lm(i).x, lm(i).y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#22c55e';
            ctx.fill();
          });
        }

        if (bufferRef.current.isStable() && phaseRef.current === 'scanning') {
          setStableValue(sm);
          sp('stable');
        }
      }
    } else {
      // Low confidence — reset buffer so we don't carry stale readings
      if (phaseRef.current === 'scanning') {
        bufferRef.current.reset();
      }
    }
  }, [sp]);

  // ─── RAF loop: runs MediaPipe on every video frame ───
  const processFrame = useCallback(() => {
    if (!isRunningRef.current) return;

    const video = videoRef.current;
    const pose  = poseRef.current;

    if (!video || !pose) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || video.paused || video.ended) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      const results = pose.detectForVideo(video, performance.now());
      if (results.landmarks?.[0]) {
        onPoseResults(results.landmarks[0]);
      } else {
        setArmDetected(false);
        // Clear canvas when no pose found
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (e) {
      console.error('Detection error:', e);
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [onPoseResults]);

  // ─── Load MediaPipe + start camera ───
  const loadMediaPipe = async () => {
    setModelError(null);

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

      // ─── Camera: three-tier fallback ───
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      let stream: MediaStream | null = null;

      const attempts = [
        { facingMode: { ideal: 'environment' }, width: { ideal: isMobile ? 640 : 1280 }, height: { ideal: isMobile ? 480 : 720 } },
        { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        {} as MediaTrackConstraints, // bare minimum
      ];

      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
          break;
        } catch (e: any) {
          if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            setModelError('Camera permission denied.\n\nAllow camera access in your browser settings, then tap Retry.');
            return;
          }
        }
      }

      if (!stream) {
        setModelError('Could not access camera. Make sure no other app is using it.');
        return;
      }

      streamRef.current = stream;

      // ─── KEY FIX: videoRef always exists — it's in the persistent layer ───
      const video = videoRef.current!;
      video.muted    = true;
      video.srcObject = stream;

      // Wait for video to be ready to play
      await new Promise<void>((resolve) => {
        // Already ready?
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          video.play().catch(() => {}).finally(resolve);
          return;
        }
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          video.play().catch(() => {}).finally(resolve);
        };
        // Belt and braces: listen to all three events
        video.onloadedmetadata = settle;
        video.oncanplay        = settle;
        video.oncanplaythrough = settle;
        // Timeout fallback — 10s, then try anyway
        setTimeout(() => {
          if (!settled) { settled = true; video.play().catch(() => {}).finally(resolve); }
        }, 10000);
      });

      sp('guide');

    } catch (err: any) {
      console.error('Setup error:', err);
      setModelError(err?.message ?? 'Failed to load. Check your internet connection and try again.');
    }
  };

  // ─── Start scanning (called from button tap — works as user gesture for Safari) ───
  const startScanning = useCallback(async () => {
    const video = videoRef.current;

    // If video somehow paused (Safari), resume inside user gesture
    if (video && video.paused) {
      try { await video.play(); } catch {}
    }

    bufferRef.current.reset();
    setLiveValue(null);
    sp('scanning');

    if (!isRunningRef.current) {
      isRunningRef.current = true;
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [sp, processFrame]);

  const handleSave = async () => {
    if (!selectedChild || stableValue === null) return;
    setSaving(true);
    const worker = getWorker();
    const s: Screening = {
      id:              `scr_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
      childId:         selectedChild.id,
      muacCm:          parseFloat(stableValue.toFixed(1)),
      riskLevel:       classifyMUAC(stableValue),
      notes:           notes.trim(),
      screenedAt:      Date.now(),
      healthWorkerId:  worker?.id ?? 'unknown',
      synced:          false,
    };
    try { await saveScreening(s); } catch (e) { console.error(e); }
    stopLoop();
    sp('saved');
    setSaving(false);
  };

  const rl: RiskLevel = stableValue !== null ? classifyMUAC(stableValue) : 'unknown';

  const isCamera = phase === 'guide' || phase === 'scanning' || phase === 'stable';

  return (
    <>
      {/*
        ══════════════════════════════════════════════════════
        PERSISTENT CAMERA LAYER — always in DOM, never unmounts
        This is the root cause fix: srcObject survives phase changes
        Visibility controlled by CSS only, NOT by React conditional render
        ══════════════════════════════════════════════════════
      */}
      <div style={{
        position: 'fixed', inset: 0,
        zIndex: isCamera ? 0 : -1,
        opacity: isCamera ? 1 : 0,
        pointerEvents: isCamera ? 'auto' : 'none',
        background: '#000',
      }}>
        {/* Video: always mounted, always has srcObject after loadMediaPipe */}
        <video
          ref={videoRef}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
          playsInline
          muted
          autoPlay
        />
        {/* Canvas: transparent overlay for pose landmarks */}
        <canvas
          ref={canvasRef}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
        />

        {/* Guide overlay */}
        {phase === 'guide' && (
          <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', padding:24, paddingBottom:40, justifyContent:'space-between', background:'rgba(0,0,0,0.45)' }}>
            <div style={{ color:'white' }}>
              <p style={{ margin:'0 0 4px', opacity:0.75, fontSize:13 }}>Screening</p>
              <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>{selectedChild?.name}</h2>
            </div>
            <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:20, padding:22, backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.18)', color:'white' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:17, fontWeight:700 }}>Position the arm</h3>
              {['📏 Extend arm straight out to the side', '📱 Hold phone 40–60cm away', '💡 Good lighting on the arm', '🎯 Full arm visible: shoulder to wrist'].map((s,i) => (
                <div key={i} style={{ fontSize:14, lineHeight:1.7 }}>{s}</div>
              ))}
            </div>
            <button className="btn-primary" onClick={startScanning}>Start Scanning →</button>
          </div>
        )}

        {/* Scanning overlay */}
        {(phase === 'scanning' || phase === 'stable') && (
          <>
            <div style={{ position:'absolute', top:0, left:0, right:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)', padding:'20px 20px 40px', color:'white', zIndex:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ margin:0, fontWeight:600, fontSize:15 }}>
                  {armDetected ? '✅ Arm detected' : '🔍 Looking for arm...'}
                </p>
                <div style={{ background: armDetected ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.15)', border:`1px solid ${armDetected?'#22c55e':'rgba(255,255,255,0.3)'}`, borderRadius:20, padding:'6px 14px', fontSize:13, fontWeight:600, color:'white' }}>
                  {Math.round(confidence * 100)}%
                </div>
              </div>
            </div>

            <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', padding:'48px 24px 40px', color:'white', zIndex:10 }}>
              {liveValue !== null && (
                <div style={{ textAlign:'center', marginBottom:20 }}>
                  <div style={{ fontSize:56, fontWeight:700, lineHeight:1 }}>
                    {liveValue.toFixed(1)}<span style={{ fontSize:22, opacity:0.7, marginLeft:4 }}>cm</span>
                  </div>
                  <p style={{ margin:'6px 0 0', opacity:0.7, fontSize:13 }}>
                    {bufferRef.current.isStable() ? '✅ Reading stable' : 'Hold steady...'}
                  </p>
                </div>
              )}
              {phase === 'stable' && (
                <button className="btn-primary" onClick={() => { stopLoop(); sp('result'); }}>
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
          </>
        )}
      </div>

      {/* ══ PAGE CONTENT — rendered on top of (or instead of) camera layer ══ */}

      {phase === 'select-child' && (
        <div>
          <div className="page-header">
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Screen Child</h1>
            <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>Select child to screen</p>
          </div>
          <div style={{ padding:'16px 20px' }}>
            <button className="btn-primary" onClick={() => router.push('/children/new')} style={{ marginBottom:20 }}>
              + Register New Child
            </button>
            {children.length === 0
              ? <div className="empty-state"><div style={{ fontSize:40, marginBottom:12 }}>👶</div><p style={{ margin:0, fontWeight:600 }}>No children registered yet</p></div>
              : children.map(child => (
                <button key={child.id}
                  onClick={() => { setSelectedChild(child); sp('loading-model'); }}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'white', border:'1.5px solid var(--stone-200)', borderRadius:12, cursor:'pointer', textAlign:'left', width:'100%', marginBottom:8 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:child.sex==='female'?'#fce7f3':'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
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
      )}

      {phase === 'loading-model' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', gap:16, background:'var(--forest)', color:'white', padding:24, textAlign:'center' }}>
          {!modelError && (
            <>
              <div className="spinner" />
              <p style={{ margin:0, fontWeight:600 }}>Loading AI model...</p>
              <p style={{ margin:0, fontSize:13, opacity:0.7 }}>First use: 30–60s download</p>
              <p style={{ margin:0, fontSize:12, opacity:0.5 }}>Subsequent loads are instant</p>
            </>
          )}
          {modelError && (
            <div style={{ background:'rgba(220,38,38,0.18)', padding:'20px 24px', borderRadius:12, maxWidth:320 }}>
              <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:15 }}>⚠ Setup Error</p>
              <p style={{ margin:'0 0 16px', fontSize:14, lineHeight:1.6, opacity:0.9, whiteSpace:'pre-line' }}>{modelError}</p>
              <button onClick={() => { setModelError(null); loadMediaPipe(); }}
                style={{ padding:'10px 20px', background:'white', color:'var(--forest)', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', marginRight:10 }}>
                Retry
              </button>
              <button onClick={() => { stopCamera(); sp('select-child'); }}
                style={{ padding:'10px 20px', background:'transparent', color:'white', border:'1px solid rgba(255,255,255,0.4)', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
                Go Back
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div style={{ position:'relative', zIndex:10, background:'var(--bg, #f5f2eb)' }}>
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
              {rl==='green'  && <p style={{ margin:0, fontSize:14, lineHeight:1.6 }}>Child is well nourished. Re-screen in 3 months.</p>}
              {rl==='yellow' && <p style={{ margin:0, fontSize:14, lineHeight:1.6, color:'var(--risk-yellow)' }}>⚠️ Moderate malnutrition. Enrol in supplementary feeding. Re-screen in 4 weeks.</p>}
              {rl==='red'    && <p style={{ margin:0, fontSize:14, lineHeight:1.6, color:'var(--risk-red)' }}>🚨 Severe malnutrition. Refer immediately to therapeutic feeding centre.</p>}
            </div>
            <div>
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={3} placeholder="Observations..." value={notes} onChange={e => setNotes(e.target.value)} style={{ resize:'none' }} />
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <div className="spinner" /> : '💾 Save Record'}
            </button>
            <button className="btn-secondary" onClick={() => { startScanning(); }}>
              Retake Reading
            </button>
          </div>
        </div>
      )}

      {phase === 'saved' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', padding:32, textAlign:'center', background:'var(--bg, #f5f2eb)', position:'relative', zIndex:10 }}>
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
      )}
    </>
  );
}

export default function ScreenPage() {
  return <Suspense><ScreenInner /></Suspense>;
}