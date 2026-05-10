'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getChildren, saveScreening } from '@/lib/db';
import { MUACReadingBuffer, estimateMUACFromLandmarks } from '@/lib/muac';
import {
  RISK_LABELS, RISK_ACTIONS, RISK_COLORS, RISK_BG_COLORS, RISK_BORDER_COLORS,
  classifyMUAC, type Child, type Screening, type RiskLevel
} from '@/types';

type Phase = 'select-child'|'loading-model'|'guide'|'scanning'|'stable'|'result'|'saved';
type ArmOrientation = 'horizontal' | 'vertical';

function getWorker() {
  try { return JSON.parse(localStorage.getItem('nuruscreen_worker_data') || 'null'); } catch { return null; }
}

// ── Arm guide overlay — supports both horizontal and vertical arm positions ──
function ArmGuideOverlay({
  armDetected,
  orientation,
  onToggle,
}: {
  armDetected: boolean;
  orientation: ArmOrientation;
  onToggle: () => void;
}) {
  const stroke  = armDetected ? '#22c55e' : 'rgba(255,255,255,0.75)';
  const dotFill = armDetected ? '#22c55e' : 'rgba(255,255,255,0.5)';

  // Horizontal: arm extended sideways (recommended — wider ellipse)
  // Vertical:   arm hanging down (narrow tall ellipse)
  const cx = 195, cy = 422;
  const rx = orientation === 'horizontal' ? 148 : 52;
  const ry = orientation === 'horizontal' ? 58  : 160;

  // Corner markers adapt to ellipse bounding box
  const x1 = cx - rx, x2 = cx + rx;
  const y1 = cy - ry, y2 = cy + ry;
  const cm = 24; // corner marker length

  const corners = [
    [[x1, y1+cm], [x1, y1], [x1+cm, y1]],
    [[x2-cm, y1], [x2, y1], [x2, y1+cm]],
    [[x1, y2-cm], [x1, y2], [x1+cm, y2]],
    [[x2-cm, y2], [x2, y2], [x2, y2-cm]],
  ];

  const labelY = y2 + 30;
  const subLabelY = y2 + 50;

  const horizontalHint = 'shoulder ←──── upper arm ────→ wrist';
  const verticalHint   = 'shoulder\n    ↑\nupper arm\n    ↑\n wrist';

  return (
    <svg
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:6, pointerEvents:'none' }}
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <mask id="arm-guide-mask">
          <rect width="390" height="844" fill="white"/>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black"/>
        </mask>
      </defs>

      {/* Dark surround with arm-cutout */}
      <rect width="390" height="844" fill="rgba(0,0,0,0.50)" mask="url(#arm-guide-mask)"/>

      {/* Guide ellipse */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke={stroke} strokeWidth="2.5" strokeDasharray="9 5"/>

      {/* MUAC measurement point (mid upper arm) */}
      <circle cx={cx} cy={cy} r={7} fill={dotFill}/>
      <line x1={cx-18} y1={cy} x2={cx+18} y2={cy} stroke={stroke} strokeWidth="1.5" opacity="0.6"/>
      <line x1={cx} y1={cy-18} x2={cx} y2={cy+18} stroke={stroke} strokeWidth="1.5" opacity="0.6"/>

      {/* Corner markers */}
      {corners.map((pts, i) => (
        <polyline key={i}
          points={pts.map(([x,y]) => `${x},${y}`).join(' ')}
          fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.85"/>
      ))}

      {/* Status text */}
      {!armDetected && (
        <>
          <text x={cx} y={labelY} textAnchor="middle"
            fill="white" fontSize="14" fontFamily="sans-serif" fontWeight="500">
            Place upper arm inside the outline
          </text>
          <text x={cx} y={subLabelY} textAnchor="middle"
            fill="rgba(255,255,255,0.55)" fontSize="11" fontFamily="sans-serif">
            {orientation === 'horizontal' ? horizontalHint : 'Arm hanging straight down'}
          </text>
        </>
      )}
      {armDetected && (
        <text x={cx} y={labelY} textAnchor="middle"
          fill="#22c55e" fontSize="15" fontFamily="sans-serif" fontWeight="600">
          ✓ Arm detected — hold steady
        </text>
      )}

      {/* Orientation toggle button — always tappable */}
      <g
        onClick={onToggle}
        style={{ cursor:'pointer', pointerEvents:'all' }}
        transform="translate(310, 30)"
      >
        <rect width="70" height="36" rx="8" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
        <text x="35" y="14" textAnchor="middle" fill="white" fontSize="9"
          fontFamily="sans-serif" fontWeight="600" letterSpacing="0.05em">
          ARM
        </text>
        <text x="35" y="27" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10"
          fontFamily="sans-serif">
          {orientation === 'horizontal' ? '↔ horiz' : '↕ vert'}
        </text>
      </g>
    </svg>
  );
}

// ── Animated loading screen — field-worker friendly copy ──
function LoadingScreen({ error, onRetry, onBack }: {
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (error) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, [error]);

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'100dvh', gap:0, background:'var(--forest)', color:'white',
      padding:24, textAlign:'center',
    }}>
      {!error && (
        <>
          {/* NuruScreen logo mark */}
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ marginBottom:24 }}>
            <circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.12)"/>
            <circle cx="32" cy="32" r="19" fill="none" stroke="rgba(255,255,255,0.6)"
              strokeWidth="2" strokeDasharray="4 3"/>
            <line x1="32" y1="16" x2="32" y2="48" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="16" y1="32" x2="48" y2="32" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="32" cy="32" r="4" fill="#22c55e"/>
          </svg>

          <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:20 }}>
            Starting NuruScreen{dots}
          </p>
          <p style={{ margin:'0 0 32px', fontSize:13, opacity:0.65, lineHeight:1.5 }}>
            Preparing AI screening tools
          </p>

          {/* Progress steps */}
          {[
            { label:'Loading pose model', done:true },
            { label:'Activating camera', done:false },
            { label:'Ready to screen', done:false },
          ].map((step, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'8px 0', width:'100%', maxWidth:240,
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              <div style={{
                width:20, height:20, borderRadius:'50%', flexShrink:0,
                background: step.done ? '#22c55e' : 'rgba(255,255,255,0.15)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11,
              }}>
                {step.done ? '✓' : <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>}
              </div>
              <span style={{ fontSize:13, opacity: step.done ? 1 : 0.5 }}>{step.label}</span>
            </div>
          ))}

          <p style={{ margin:'28px 0 0', fontSize:11, opacity:0.35 }}>
            First load: ~30–60s · Then instant
          </p>
        </>
      )}

      {error && (
        <div style={{ background:'rgba(220,38,38,0.18)', padding:'20px 24px', borderRadius:12, maxWidth:320 }}>
          <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:15 }}>⚠ Setup Error</p>
          <p style={{ margin:'0 0 16px', fontSize:14, lineHeight:1.6, opacity:0.9, whiteSpace:'pre-line' }}>{error}</p>
          <button onClick={onRetry}
            style={{ padding:'12px 20px', background:'white', color:'var(--forest)', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', marginRight:10, fontSize:15 }}>
            Retry
          </button>
          <button onClick={onBack}
            style={{ padding:'12px 20px', background:'transparent', color:'white', border:'1px solid rgba(255,255,255,0.4)', borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:15 }}>
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}

function ScreenInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream|null>(null);
  const poseRef      = useRef<any>(null);
  const bufferRef    = useRef(new MUACReadingBuffer(12));
  const animFrameRef = useRef<number>(0);
  const phaseRef     = useRef<Phase>('select-child');
  const isRunningRef = useRef(false);

  const [phase, setPhase]                 = useState<Phase>('select-child');
  const [children, setChildren]           = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child|null>(null);
  const [liveValue, setLiveValue]         = useState<number|null>(null);
  const [stableValue, setStableValue]     = useState<number|null>(null);
  const [armDetected, setArmDetected]     = useState(false);
  const [confidence, setConfidence]       = useState(0);
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  const [modelError, setModelError]       = useState<string|null>(null);
  const [orientation, setOrientation]     = useState<ArmOrientation>('horizontal');

  const sp = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  const stopLoop = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoop]);

  useEffect(() => {
    const worker = getWorker();
    if (!worker) { router.replace('/login'); return; }
    getChildren(worker.id).then(setChildren);
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
    if (phase === 'loading-model') loadMediaPipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onPoseResults = useCallback((landmarks: any[]) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

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

        if (est.armDetected && est.side) {
          const s  = est.side;
          const eI = s==='left'?13:14, wI = s==='left'?15:16, shI = s==='left'?11:12;
          const lm = (i: number) => ({ x: landmarks[i].x * canvas.width, y: landmarks[i].y * canvas.height });

          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(lm(shI).x, lm(shI).y);
          ctx.lineTo(lm(eI).x, lm(eI).y);
          ctx.lineTo(lm(wI).x, lm(wI).y);
          ctx.stroke();

          const mx = (lm(shI).x + lm(eI).x) / 2;
          const my = (lm(shI).y + lm(eI).y) / 2;
          ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(34,197,94,0.2)'; ctx.fill();
          ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.stroke();

          [shI, eI, wI].forEach(i => {
            ctx.beginPath(); ctx.arc(lm(i).x, lm(i).y, 7, 0, Math.PI*2);
            ctx.fillStyle = '#22c55e'; ctx.fill();
          });
        }

        if (bufferRef.current.isStable() && phaseRef.current === 'scanning') {
          setStableValue(sm); sp('stable');
        }
      }
    } else {
      if (phaseRef.current === 'scanning') bufferRef.current.reset();
    }
  }, [sp]);

  const processFrame = useCallback(() => {
    if (!isRunningRef.current) return;
    const video = videoRef.current;
    const pose  = poseRef.current;
    if (!video || !pose) { animFrameRef.current = requestAnimationFrame(processFrame); return; }
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || video.paused || video.ended) {
      animFrameRef.current = requestAnimationFrame(processFrame); return;
    }
    try {
      const results = pose.detectForVideo(video, performance.now());
      if (results.landmarks?.[0]) {
        onPoseResults(results.landmarks[0]);
      } else {
        setArmDetected(false);
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (e) { console.error('Detection error:', e); }
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [onPoseResults]);

  const loadMediaPipe = async () => {
    setModelError(null);
    try {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      );
      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/pose_landmarker_lite.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1,
      });
      poseRef.current = poseLandmarker;

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      let stream: MediaStream | null = null;
      const attempts = [
        { facingMode: { ideal: 'environment' }, width: { ideal: isMobile ? 640 : 1280 }, height: { ideal: isMobile ? 480 : 720 } },
        { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        {} as MediaTrackConstraints,
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

      if (!stream) { setModelError('Could not access camera. Make sure no other app is using it.'); return; }
      streamRef.current = stream;

      const video = videoRef.current!;
      video.muted = true;
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) { video.play().catch(() => {}).finally(resolve); return; }
        let settled = false;
        const settle = () => { if (settled) return; settled = true; video.play().catch(() => {}).finally(resolve); };
        video.onloadedmetadata = settle;
        video.oncanplay        = settle;
        video.oncanplaythrough = settle;
        setTimeout(() => { if (!settled) { settled = true; video.play().catch(() => {}).finally(resolve); } }, 10000);
      });

      sp('guide');
    } catch (err: any) {
      console.error('Setup error:', err);
      setModelError(err?.message ?? 'Failed to load. Check your internet connection and try again.');
    }
  };

  const startScanning = useCallback(async () => {
    const video = videoRef.current;
    if (video && video.paused) { try { await video.play(); } catch {} }
    bufferRef.current.reset();
    setLiveValue(null);
    setArmDetected(false);
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
      id:             `scr_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
      childId:        selectedChild.id,
      muacCm:         parseFloat(stableValue.toFixed(1)),
      riskLevel:      classifyMUAC(stableValue),
      notes:          notes.trim(),
      screenedAt:     Date.now(),
      healthWorkerId: worker?.id ?? 'unknown',
      synced:         false,
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
      {/* ── PERSISTENT CAMERA LAYER ── */}
      <div style={{
        position:'fixed', inset:0,
        zIndex: isCamera ? 0 : -1,
        opacity: isCamera ? 1 : 0,
        pointerEvents: isCamera ? 'auto' : 'none',
        background:'#000',
      }}>
        <video ref={videoRef}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
          playsInline muted autoPlay />
        <canvas ref={canvasRef}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:5 }} />

        {/* Ghost overlay with orientation toggle */}
        {(phase === 'scanning' || phase === 'stable') && (
          <ArmGuideOverlay
            armDetected={armDetected}
            orientation={orientation}
            onToggle={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
          />
        )}

        {/* Guide phase */}
        {phase === 'guide' && (
          <div style={{
            position:'absolute', inset:0, zIndex:10,
            display:'flex', flexDirection:'column',
            padding:24, paddingBottom:48, justifyContent:'space-between',
            background:'rgba(0,0,0,0.5)',
          }}>
            <div style={{ color:'white' }}>
              <p style={{ margin:'0 0 2px', opacity:0.7, fontSize:13, letterSpacing:'0.05em', textTransform:'uppercase' }}>Screening</p>
              <h2 style={{ margin:0, fontSize:22, fontWeight:700 }}>{selectedChild?.name}</h2>
            </div>
            <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:16, padding:20, backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.15)', color:'white' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:16, fontWeight:700 }}>How to position</h3>
              {[
                '📏 Extend arm straight out to the side',
                '📱 Hold phone 40–60 cm from the arm',
                '💡 Good lighting — avoid shadows',
                '🎯 Full arm visible: shoulder to wrist',
              ].map((s,i) => <div key={i} style={{ fontSize:14, lineHeight:1.75 }}>{s}</div>)}
            </div>
            <button className="btn-primary" onClick={startScanning} style={{ fontSize:18 }}>
              Start Scanning →
            </button>
          </div>
        )}

        {/* Scanning / Stable phase */}
        {(phase === 'scanning' || phase === 'stable') && (
          <>
            <div style={{
              position:'absolute', top:0, left:0, right:0, zIndex:15,
              background:'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
              padding:'20px 20px 36px', color:'white',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ margin:0, fontWeight:600, fontSize:15 }}>
                  {armDetected ? '✅ Arm detected' : '🔍 Looking for arm...'}
                </p>
                <div style={{
                  background: armDetected ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.12)',
                  border:`1.5px solid ${armDetected ? '#22c55e' : 'rgba(255,255,255,0.3)'}`,
                  borderRadius:20, padding:'5px 14px', fontSize:13, fontWeight:600, color:'white',
                }}>
                  {Math.round(confidence * 100)}%
                </div>
              </div>
            </div>

            <div style={{
              position:'absolute', bottom:0, left:0, right:0, zIndex:15,
              background:'linear-gradient(to top, rgba(0,0,0,0.88), transparent)',
              padding:'52px 24px 44px', color:'white',
            }}>
              {liveValue !== null && (
                <div style={{ textAlign:'center', marginBottom:20 }}>
                  <div style={{ fontSize:60, fontWeight:700, lineHeight:1, fontFamily:'monospace' }}>
                    {liveValue.toFixed(1)}<span style={{ fontSize:22, opacity:0.65, marginLeft:6 }}>cm</span>
                  </div>
                  <p style={{ margin:'8px 0 0', fontSize:13, opacity:0.75 }}>
                    {bufferRef.current.isStable() ? '✅ Reading stable' : 'Hold steady...'}
                  </p>
                </div>
              )}
              {phase === 'stable' && (
                <button className="btn-primary" style={{ fontSize:17 }} onClick={() => { stopLoop(); sp('result'); }}>
                  ✓ Confirm — {stableValue?.toFixed(1)} cm
                </button>
              )}
              {phase === 'scanning' && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:16, background:'rgba(255,255,255,0.1)', borderRadius:12 }}>
                  <div className="spinner" style={{ width:18, height:18, borderWidth:2 }}/>
                  <span style={{ fontSize:14 }}>Analysing arm position...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ PAGE CONTENT ══ */}

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
                  <span style={{ color:'var(--stone-400)', fontSize:18 }}>›</span>
                </button>
              ))
            }
          </div>
        </div>
      )}

      {phase === 'loading-model' && (
        <LoadingScreen
          error={modelError}
          onRetry={() => { setModelError(null); loadMediaPipe(); }}
          onBack={() => { stopCamera(); sp('select-child'); }}
        />
      )}

      {phase === 'result' && (
        <div style={{ position:'relative', zIndex:10, background:'white', minHeight:'100dvh' }}>
          <div className="page-header">
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Result</h1>
            <p style={{ margin:'4px 0 0', opacity:0.7, fontSize:14 }}>{selectedChild?.name}</p>
          </div>
          <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{
              padding:'24px 20px', borderRadius:16, textAlign:'center',
              background: RISK_BG_COLORS[rl], border:`3px solid ${RISK_BORDER_COLORS[rl]}`,
            }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:60, fontWeight:500, letterSpacing:'-0.02em', lineHeight:1, color: RISK_COLORS[rl] }}>
                {stableValue?.toFixed(1)}<span style={{ fontSize:24, opacity:0.7, marginLeft:6 }}>cm</span>
              </div>
              <p style={{ margin:'12px 0 4px', fontSize:20, fontWeight:700, color: RISK_COLORS[rl] }}>{RISK_LABELS[rl]}</p>
              <p style={{ margin:'4px 0 0', fontSize:14, fontWeight:500, color: RISK_COLORS[rl], opacity:0.85 }}>{RISK_ACTIONS[rl]}</p>
              <p style={{ margin:'10px 0 0', fontSize:12, color:'var(--stone-400)' }}>WHO MUAC classification</p>
            </div>

            <div className="card card-padded">
              <p className="form-label" style={{ marginBottom:10 }}>MUAC Reference Scale</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[
                  { label:'✓  Well Nourished', range:'≥ 13.5 cm', bg:'#dcfce7', color:'#14532d', active: rl==='green' },
                  { label:'⚠  Moderate (MAM)', range:'11.5–13.5 cm', bg:'#fef3c7', color:'#92400e', active: rl==='yellow' },
                  { label:'!  Urgent — SAM',   range:'< 11.5 cm',   bg:'#fee2e2', color:'#991b1b', active: rl==='red' },
                ].map(r => (
                  <div key={r.label} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'8px 12px', borderRadius:8,
                    background: r.active ? r.bg : 'transparent',
                    border: r.active ? `2px solid ${r.color}` : '1px solid var(--stone-200)',
                  }}>
                    <span style={{ fontSize:13, fontWeight: r.active ? 700 : 500, color: r.active ? r.color : 'var(--stone-600)' }}>{r.label}</span>
                    <span style={{ fontSize:13, fontFamily:'var(--font-mono)', color: r.active ? r.color : 'var(--stone-400)' }}>{r.range}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={3} placeholder="Observations about this child..."
                value={notes} onChange={e => setNotes(e.target.value)} style={{ resize:'none', fontSize:16 }} />
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <div className="spinner"/> : '💾 Save Record'}
            </button>
            <button className="btn-secondary" onClick={() => { bufferRef.current.reset(); setLiveValue(null); startScanning(); }}>
              ↺ Retake Reading
            </button>
          </div>
        </div>
      )}

      {phase === 'saved' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100dvh', padding:32, textAlign:'center', background:'white', position:'relative', zIndex:10 }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, marginBottom:24 }}>✅</div>
          <h2 style={{ margin:'0 0 8px', fontSize:24, fontWeight:700 }}>Saved</h2>
          <p style={{ margin:'0 0 32px', color:'var(--stone-600)', lineHeight:1.6, fontSize:15 }}>
            Record for <strong>{selectedChild?.name}</strong> saved to device.
          </p>
          <button className="btn-primary" style={{ maxWidth:300 }} onClick={() => {
            sp('select-child'); setSelectedChild(null);
            setLiveValue(null); setStableValue(null);
            setNotes(''); bufferRef.current.reset();
          }}>Screen Another Child</button>
          <button className="btn-secondary" style={{ maxWidth:300, marginTop:10 }} onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      )}
    </>
  );
}

export default function ScreenPage() {
  return <Suspense><ScreenInner/></Suspense>;
}