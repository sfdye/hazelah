import {
  ApiEnvelope,
  HistoryEntry,
  Pm25Readings,
  PsiReadings,
  RegionName,
  Snapshot,
} from './types';

const BASE = 'https://api-open.data.gov.sg/v2/real-time/api';
const LEGACY_PM25 = 'https://api.data.gov.sg/v1/environment/pm25';

async function getLatest<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  if (json.code !== 0 || json.data.items.length === 0) {
    throw new Error(json.errorMsg || `${path}: no data`);
  }
  return json;
}

export async function fetchSnapshot(): Promise<Snapshot> {
  const [psiRes, pm25Res] = await Promise.all([
    getLatest<PsiReadings>('psi'),
    getLatest<Pm25Readings>('pm25'),
  ]);
  const psiItem = psiRes.data.items[0];
  const pm25Item = pm25Res.data.items[0];

  const regions: RegionName[] = ['central', 'east', 'north', 'south', 'west'];
  const readings = {} as Snapshot['readings'];
  for (const r of regions) {
    readings[r] = {
      pm25: pm25Item.readings.pm25_one_hourly[r] ?? null,
      psi: psiItem.readings.psi_twenty_four_hourly[r] ?? null,
    };
  }
  return {
    timestamp: psiItem.timestamp,
    updatedTimestamp: psiItem.updatedTimestamp,
    readings,
  };
}

export function sgDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

interface LegacyItem {
  timestamp: string;
  readings?: { pm25_one_hourly?: Record<string, number | null> };
}

// Legacy v1 endpoint: returns a full day of hourly PM2.5 readings.
export async function fetchDayPm25(date: string): Promise<HistoryEntry[]> {
  const res = await fetch(`${LEGACY_PM25}?date=${date}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: LegacyItem[] };
  const out: HistoryEntry[] = [];
  for (const it of json.items ?? []) {
    const pm25 = it.readings?.pm25_one_hourly;
    if (!pm25) continue;
    const values = Object.fromEntries(
      Object.entries(pm25).filter(([, v]) => v != null),
    );
    if (!Object.keys(values).length) continue;
    out.push({ t: Date.parse(it.timestamp), pm25: values, psi: {} });
  }
  return out;
}
