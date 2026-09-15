import {
  ApiEnvelope,
  Pm25Readings,
  PsiReadings,
  RegionName,
  Snapshot,
} from './types';

const BASE = 'https://api-open.data.gov.sg/v2/real-time/api';

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
