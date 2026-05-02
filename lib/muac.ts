import { classifyMUAC, type RiskLevel } from '@/types';

export interface PoseLandmark { x: number; y: number; z: number; visibility?: number; }
export interface MUACEstimate {
  muacCm: number | null; riskLevel: RiskLevel; confidence: number;
  armDetected: boolean; side: 'left' | 'right' | null;
  debugInfo: { pixelDistance: number | null; scaleFactor: number | null; elbowVisibility: number; wristVisibility: number; };
}

export function estimateMUACFromLandmarks(landmarks: PoseLandmark[], imageWidth: number, imageHeight: number): MUACEstimate {
  const nullResult: MUACEstimate = { muacCm: null, riskLevel: 'unknown', confidence: 0, armDetected: false, side: null, debugInfo: { pixelDistance: null, scaleFactor: null, elbowVisibility: 0, wristVisibility: 0 } };
  if (!landmarks || landmarks.length < 17) return nullResult;
  const [lSh, rSh, lEl, rEl, lWr, rWr] = [11,12,13,14,15,16].map(i => landmarks[i]);
  if (!lEl || !lWr || !rEl || !rWr) return nullResult;
  const leftVis = Math.min(lEl.visibility ?? 0, lWr.visibility ?? 0);
  const rightVis = Math.min(rEl.visibility ?? 0, rWr.visibility ?? 0);
  if (leftVis < 0.6 && rightVis < 0.6) return nullResult;
  const side = leftVis >= rightVis ? 'left' : 'right';
  const elbow = side === 'left' ? lEl : rEl;
  const wrist = side === 'left' ? lWr : rWr;
  const shoulder = side === 'left' ? lSh : rSh;
  const px = (lm: PoseLandmark) => ({ x: lm.x * imageWidth, y: lm.y * imageHeight });
  const ePx = px(elbow), wPx = px(wrist), sPx = px(shoulder);
  const dist = (a: {x:number,y:number}, b: {x:number,y:number}) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
  const forearmPx = dist(ePx, wPx), upperArmPx = dist(sPx, ePx);
  if (upperArmPx < 10 || forearmPx < 10) return nullResult;
  const pixelsPerCm = upperArmPx / 14.0;
  const upperArmCm = upperArmPx / pixelsPerCm;
  const estimatedMUAC = 0.31 * upperArmCm + 7.2;
  const confidence = Math.min(elbow.visibility ?? 0, wrist.visibility ?? 0) * (upperArmCm > 8 && upperArmCm < 25 ? 1 : 0.5);
  const muacCm = Math.max(8, Math.min(18, estimatedMUAC));
  return { muacCm, riskLevel: classifyMUAC(muacCm), confidence, armDetected: true, side, debugInfo: { pixelDistance: forearmPx, scaleFactor: pixelsPerCm, elbowVisibility: elbow.visibility ?? 0, wristVisibility: wrist.visibility ?? 0 } };
}

export class MUACReadingBuffer {
  private readings: number[] = [];
  constructor(private bufferSize = 10) {}
  add(v: number) { this.readings.push(v); if (this.readings.length > this.bufferSize) this.readings.shift(); }
  getSmoothed(): number | null {
    if (this.readings.length < 3) return null;
    const s = [...this.readings].sort((a,b) => a-b).slice(1,-1);
    return s.reduce((a,b) => a+b, 0) / s.length;
  }
  isStable(): boolean {
    if (this.readings.length < this.bufferSize) return false;
    const avg = this.getSmoothed()!;
    return Math.sqrt(this.readings.reduce((s,v) => s+(v-avg)**2, 0) / this.readings.length) < 0.5;
  }
  reset() { this.readings = []; }
}
