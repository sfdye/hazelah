import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryEntry, RegionReading, Snapshot } from './types';

const KEY = 'hazelah.history.v1';
// 24h at 15-min cadence
const CAP = 96;

export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function pick(
  readings: Record<string, RegionReading>,
  key: 'pm25' | 'psi',
): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const [region, reading] of Object.entries(readings)) {
    const v = reading[key];
    if (v != null) out[region] = v;
  }
  return out;
}

export async function appendHistory(snap: Snapshot): Promise<HistoryEntry[]> {
  const history = await loadHistory();
  const entry: HistoryEntry = {
    t: Date.parse(snap.timestamp),
    pm25: pick(snap.readings, 'pm25'),
    psi: pick(snap.readings, 'psi'),
  };
  const next = [...history.filter((e) => e.t !== entry.t), entry].slice(-CAP);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
