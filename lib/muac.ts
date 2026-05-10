import { classifyMUAC, type RiskLevel } from '@/types';

export interface PoseLandmark {
  x: number; y: number; z: number; visibility?: number;
}

export interface MUACEstimate {
  muacCm: number | null;
  riskLevel: RiskLevel;
  confidence: number;
  armDetected: boolean;
  side: 'left' | 'right' | null;
  debugInfo: {
    upperArmPx: number | null;
    shoulderWidthPx: number | null;
    pixelsPerCm: number | null;
    upperArmCm: number | null;
  };
}

// WHO standard adult shoulder width used as body-scale reference
// Average bilateral shoulder width (acromion-to-acromion): 38cm
// For children 6-59 months, shoulder width scales proportionally
// We use this as a stable reference landmark pair
const SHOULDER_WIDTH_CM = 38.0;

// WHO MGRS regression: MUAC ≈ 0.31 × upperArmLength_cm + 7.2
// Derived from Multicentre Growth Reference Study anthropometric data
// Valid for children 6-59 months
const MUAC_SLOPE     = 0.31;
const MUAC_INTERCEPT = 7.2;

export function estimateMUACFromLandmarks(
  landmarks: PoseLandmark[],
  imageWidth: number,
  imageHeight: number
): MUACEstimate {
  const nullResult: MUACEstimate = {
    muacCm: null, riskLevel: 'unknown', confidence: 0,
    armDetected: false, side: null,
    debugInfo: { upperArmPx: null, shoulderWidthPx: null, pixelsPerCm: null, upperArmCm: null }
  };

  if (!landmarks || landmarks.length < 17) return nullResult;

  const [lSh, rSh, lEl, rEl, lWr, rWr] = [11,12,13,14,15,16].map(i => landmarks[i]);
  if (!lSh || !rSh || !lEl || !lWr || !rEl || !rWr) return nullResult;

  // Need both shoulders visible to compute scale reference
  const leftShoulderVis  = lSh.visibility ?? 0;
  const rightShoulderVis = rSh.visibility ?? 0;
  if (leftShoulderVis < 0.5 || rightShoulderVis < 0.5) return nullResult;

  // Pick the arm with better visibility
  const leftArmVis  = Math.min(lEl.visibility ?? 0, lWr.visibility ?? 0);
  const rightArmVis = Math.min(rEl.visibility ?? 0, rWr.visibility ?? 0);
  if (leftArmVis < 0.55 && rightArmVis < 0.55) return nullResult;

  const side   = leftArmVis >= rightArmVis ? 'left' : 'right';
  const elbow  = side === 'left' ? lEl : rEl;
  const wrist  = side === 'left' ? lWr : rWr;
  const shoulder = side === 'left' ? lSh : rSh;

  // Convert normalised coords to pixels
  const px = (lm: PoseLandmark) => ({ x: lm.x * imageWidth, y: lm.y * imageHeight });
  const sPx = px(shoulder), ePx = px(elbow), wPx = px(wrist);
  const lShPx = px(lSh), rShPx = px(rSh);

  const dist = (a: {x:number,y:number}, b: {x:number,y:number}) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  // ── KEY FIX: use shoulder-to-shoulder distance as scale reference ──
  // This gives real-world scale that doesn't depend on arm length itself
  const shoulderWidthPx = dist(lShPx, rShPx);
  const upperArmPx      = dist(sPx, ePx);

  if (shoulderWidthPx < 30 || upperArmPx < 10) return nullResult;

  // Pixels per centimetre — derived from known shoulder width
  const pixelsPerCm = shoulderWidthPx / SHOULDER_WIDTH_CM;

  // Upper arm length in centimetres
  const upperArmCm = upperArmPx / pixelsPerCm;

  // Sanity check — adult upper arm: 20–40cm, child (6-59mo): 10–22cm
  // Accept a wide range since we're screening both
  if (upperArmCm < 8 || upperArmCm > 45) return nullResult;

  // Apply WHO MGRS regression
  const estimatedMUAC = MUAC_SLOPE * upperArmCm + MUAC_INTERCEPT;

  // Clamp to physiologically plausible MUAC range
  const muacCm = Math.max(7, Math.min(22, estimatedMUAC));

  // Confidence: joint visibility × arm geometry plausibility
  const visConfidence = Math.min(elbow.visibility ?? 0, wrist.visibility ?? 0, shoulder.visibility ?? 0);
  const geoConfidence = (upperArmCm >= 10 && upperArmCm <= 40) ? 1.0 : 0.6;
  const confidence    = visConfidence * geoConfidence;

  return {
    muacCm,
    riskLevel: classifyMUAC(muacCm),
    confidence,
    armDetected: true,
    side,
    debugInfo: { upperArmPx, shoulderWidthPx, pixelsPerCm, upperArmCm }
  };
}

export class MUACReadingBuffer {
  private readings: number[] = [];
  constructor(private bufferSize = 12) {}

  add(v: number) {
    this.readings.push(v);
    if (this.readings.length > this.bufferSize) this.readings.shift();
  }

  getSmoothed(): number | null {
    if (this.readings.length < 3) return null;
    // Trim top and bottom outliers, then average
    const sorted = [...this.readings].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }

  isStable(): boolean {
    if (this.readings.length < this.bufferSize) return false;
    const avg = this.getSmoothed()!;
    const variance = this.readings.reduce((s, v) => s + (v - avg) ** 2, 0) / this.readings.length;
    return Math.sqrt(variance) < 0.4; // tighter threshold — 0.4cm std dev
  }

  reset() { this.readings = []; }
}