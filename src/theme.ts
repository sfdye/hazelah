import { Band } from './airQuality';

export interface BandTheme {
  color: string;
  bgFrom: string;
  bgTo: string;
}

export const BAND_THEME: Record<Band, BandTheme> = {
  normal: { color: '#30D158', bgFrom: '#0B3D2E', bgTo: '#04140D' },
  elevated: { color: '#FFD60A', bgFrom: '#4A3900', bgTo: '#171200' },
  high: { color: '#FF9F0A', bgFrom: '#4A2D00', bgTo: '#170E00' },
  veryHigh: { color: '#FF453A', bgFrom: '#4A0F0B', bgTo: '#170403' },
};

export const COLORS = {
  text: '#FFFFFF',
  subtext: 'rgba(255,255,255,0.72)',
  faint: 'rgba(255,255,255,0.45)',
  chip: 'rgba(255,255,255,0.12)',
  divider: 'rgba(255,255,255,0.15)',
};

export const FALLBACK_THEME = BAND_THEME.normal;
