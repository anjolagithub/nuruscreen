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

export const RISK_LABELS: Record<RiskLevel, string> = {
  green: 'Well Nourished', yellow: 'Moderate Risk — Monitor',
  red: 'Severe Risk — Refer Immediately', unknown: 'Unable to Read',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  green: '#16a34a', yellow: '#d97706', red: '#dc2626', unknown: '#6b7280',
};

export const CLIMATE_LABELS: Record<ClimateContext, string> = {
  flood: 'Flood Affected', drought: 'Drought Affected',
  displacement: 'Displaced', heatwave: 'Heatwave Affected', none: 'No Climate Event',
};
