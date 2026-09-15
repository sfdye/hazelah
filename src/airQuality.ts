export type Band = 'normal' | 'elevated' | 'high' | 'veryHigh';

export type HeadlineMetric = 'band' | 'aqi' | 'psi';

const NEA_BANDS: Array<{ max: number; band: Band; label: string }> = [
  { max: 55, band: 'normal', label: 'Normal' },
  { max: 150, band: 'elevated', label: 'Elevated' },
  { max: 250, band: 'high', label: 'High' },
  { max: Infinity, band: 'veryHigh', label: 'Very High' },
];

export function neaBand(pm25: number): { band: Band; label: string } {
  const found = NEA_BANDS.find((b) => pm25 <= b.max);
  return { band: found!.band, label: found!.label };
}

type Breakpoints = Array<[concLow: number, concHigh: number, indexLow: number, indexHigh: number]>;

// SG PSI PM2.5 row (NEA "Computation of the PSI", defined for 24-hr averages;
// applied here to 1-hr concentration per the off-label convention of hourly-PSI apps)
const SG_PM25_BREAKPOINTS: Breakpoints = [
  [0, 12, 0, 50],
  [12, 55, 50, 100],
  [55, 150, 100, 200],
  [150, 250, 200, 300],
  [250, 500, 300, 400],
  [500, 1000, 400, 500],
];

// US EPA PM2.5 24-hr breakpoints
const EPA_PM25_BREAKPOINTS: Breakpoints = [
  [0, 12.0, 0, 50],
  [12.0, 35.4, 50, 100],
  [35.4, 55.4, 100, 150],
  [55.4, 150.4, 150, 200],
  [150.4, 250.4, 200, 300],
  [250.4, 500.4, 300, 500],
];

function interp(breakpoints: Breakpoints, conc: number): number {
  if (conc <= 0) return 0;
  for (const [xLo, xHi, iLo, iHi] of breakpoints) {
    if (conc <= xHi) {
      const clamped = Math.max(conc, xLo);
      return Math.round(((iHi - iLo) / (xHi - xLo)) * (clamped - xLo) + iLo);
    }
  }
  return 500;
}

export function sgPsiSubIndex(pm25: number): number {
  return interp(SG_PM25_BREAKPOINTS, pm25);
}

export function usEpaAqi(pm25: number): number {
  return interp(EPA_PM25_BREAKPOINTS, pm25);
}

export function advisoryFor(band: Band): string {
  switch (band) {
    case 'normal':
      return 'Air quality is normal. Carry on as usual.';
    case 'elevated':
      return 'Reduce prolonged or strenuous outdoor activity.';
    case 'high':
      return 'Avoid prolonged or strenuous outdoor activity.';
    case 'veryHigh':
      return 'Minimise all outdoor activity. Higher-risk groups should take extra precautions.';
  }
}

export function psiDescriptor(psi: number): string {
  if (psi <= 50) return 'Good';
  if (psi <= 100) return 'Moderate';
  if (psi <= 200) return 'Unhealthy';
  if (psi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}
