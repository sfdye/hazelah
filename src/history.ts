import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDayPm25, sgDate } from './api';
import { HistoryEntry, RegionReading, Snapshot } from './types';

const KEY = 'hazelah.history.v1';
// 24h at 15-min cadence
const CAP = 96;
const DAY_MS = 24 * 60 * 60 * 1000;

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

// Seeds history from NEA's legacy v1 endpoint (hourly readings for a whole day),
// since live polling alone takes hours to accumulate enough points for a trend.
export async function backfillHistory(): Promise<HistoryEntry[]> {
  const existing = await loadHistory();
  const known = new Set(existing.map((e) => e.t));
  const [yesterday, today] = await Promise.all([
    fetchDayPm25(sgDate(new Date(Date.now() - DAY_MS))),
    fetchDayPm25(sgDate()),
  ]);
  const merged = [...existing];
  for (const e of [...yesterday, ...today]) {
    if (!known.has(e.t)) {
      known.add(e.t);
      merged.push(e);
    }
  }
  const next = merged.sort((a, b) => a.t - b.t).slice(-CAP);
  if (next.length !== existing.length) {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }
  return next;
}
