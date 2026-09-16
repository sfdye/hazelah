export type RegionName = 'north' | 'south' | 'east' | 'west' | 'central';

export interface RegionMetadata {
  name: RegionName;
  labelLocation: { latitude: number; longitude: number };
}

export interface ApiEnvelope<T> {
  code: number;
  errorMsg: string;
  data: {
    regionMetadata: RegionMetadata[];
    items: Array<{
      timestamp: string;
      updatedTimestamp: string;
      readings: T;
    }>;
  };
}

export interface PsiReadings {
  psi_twenty_four_hourly: Record<RegionName, number>;
  pm25_twenty_four_hourly: Record<RegionName, number>;
  pm25_sub_index: Record<RegionName, number>;
}

export interface Pm25Readings {
  pm25_one_hourly: Record<RegionName, number>;
}

export interface RegionReading {
  pm25: number | null;
  psi: number | null;
}

export interface Snapshot {
  timestamp: string;
  updatedTimestamp: string;
  readings: Record<RegionName, RegionReading>;
}

export interface HistoryEntry {
  t: number;
  pm25: Partial<Record<RegionName, number>>;
  psi: Partial<Record<RegionName, number>>;
}
