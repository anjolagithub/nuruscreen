export type RiskLevel = 'green' | 'yellow' | 'red' | 'unknown';
export type ClimateContext = 'flood' | 'drought' | 'displacement' | 'heatwave' | 'none';

export interface Child {
  id: string; name: string; ageMonths: number; sex: 'male' | 'female';
  village: string; lga: string; state: string; climateContext: ClimateContext;
  createdAt: number; healthWorkerId: string;
}

export interface Screening {
  id: string; childId: string; muacCm: number; riskLevel: RiskLevel;
  notes: string; screenedAt: number; healthWorkerId: string; synced: boolean; imageDataUrl?: string;
}

export interface HealthWorker { id: string; name: string; facility: string; phone: string; }

export const MUAC_THRESHOLDS = { green: 13.5, yellow: 11.5 };

export function classifyMUAC(muacCm: number): RiskLevel {
  if (muacCm >= MUAC_THRESHOLDS.green) return 'green';
  if (muacCm >= MUAC_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

// Icon + word + colour — three independent signals for colorblind safety
// Works at any screen brightness, in direct sunlight, for low-literacy workers
export const RISK_LABELS: Record<RiskLevel, string> = {
  green:   '✓  WELL NOURISHED',
  yellow:  '⚠  MODERATE — MAM',
  red:     '!  URGENT — SAM',
  unknown: '?  Unable to Read',
};

// Subtitle shown below the label — plain language action
export const RISK_ACTIONS: Record<RiskLevel, string> = {
  green:   'Re-screen in 3 months',
  yellow:  'Enrol in supplementary feeding programme',
  red:     'Refer to therapeutic feeding centre immediately',
  unknown: 'Repeat measurement',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  green:   '#14532d',  // darker green — better contrast on light bg
  yellow:  '#92400e',  // darker amber — better contrast on light bg
  red:     '#991b1b',  // darker red — better contrast on light bg
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
  none:         'No Climate Event',
};