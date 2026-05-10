export type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown';

// ClimateContext is now an ARRAY — a child can be flood-affected AND displaced simultaneously
export type ClimateContext = 'flood' | 'drought' | 'displacement' | 'heatwave' | 'none';
export type ClimateContexts = ClimateContext[];

export interface Child {
  id: string; name: string; ageMonths: number; sex: 'male' | 'female';
  village: string; lga: string; state: string;
  climateContexts: ClimateContexts; // was climateContext (single), now array
  createdAt: number; healthWorkerId: string;
}

export interface Screening {
  id: string; childId: string; muacCm: number; riskLevel: RiskLevel;
  notes: string; screenedAt: number; healthWorkerId: string;
  synced: boolean; imageDataUrl?: string;
}

export interface HealthWorker { id: string; name: string; facility: string; phone: string; }

export const MUAC_THRESHOLDS = { green: 13.5, yellow: 11.5 };

export function classifyMUAC(muacCm: number): RiskLevel {
  if (muacCm >= MUAC_THRESHOLDS.green) return 'green';
  if (muacCm >= MUAC_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

// Icon + word + colour — three independent signals for colorblind safety
export const RISK_LABELS: Record<RiskLevel, string> = {
  green:   '✓  WELL NOURISHED',
  yellow:  '⚠  MODERATE — MAM',
  red:     '!  URGENT — SAM',
  unknown: '?  Unable to Read',
};

export const RISK_ACTIONS: Record<RiskLevel, string> = {
  green:   'Re-screen in 3 months',
  yellow:  'Enrol in supplementary feeding programme',
  red:     'Refer to therapeutic feeding centre immediately',
  unknown: 'Repeat measurement',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  green:   '#14532d',
  yellow:  '#92400e',
  red:     '#991b1b',
  unknown: '#44403c',
};

export const RISK_BG_COLORS: Record<RiskLevel, string> = {
  green:   '#dcfce7',
  yellow:  '#fef3c7',
  red:     '#fee2e2',
  unknown: '#f5f5f4',
};

export const RISK_BORDER_COLORS: Record<RiskLevel, string> = {
  green:   '#16a34a',
  yellow:  '#d97706',
  red:     '#dc2626',
  unknown: '#a8a29e',
};

export const CLIMATE_LABELS: Record<ClimateContext, string> = {
  flood:        '🌊 Flood Affected',
  drought:      '☀️ Drought Affected',
  displacement: '🏕️ Displaced',
  heatwave:     '🌡️ Heatwave Affected',
  none:         '✓ No Climate Event',
};

// Helper: format climate contexts array for display
export function formatClimateContexts(contexts: ClimateContexts): string {
  if (!contexts || contexts.length === 0) return 'None';
  if (contexts.includes('none')) return 'No Climate Event';
  return contexts.map(c => CLIMATE_LABELS[c]).join(', ');
}