import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Circle as MapCircle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchSnapshot } from './src/api';
import { DARK_MAP_STYLE } from './src/mapStyle';
import { appendHistory, backfillHistory, loadHistory } from './src/history';
import {
  HeadlineMetric,
  advisoryFor,
  neaBand,
  psiBand,
  psiDescriptor,
  usEpaAqi,
} from './src/airQuality';
import { BAND_THEME, COLORS, FALLBACK_THEME, withAlpha } from './src/theme';
import { REGIONS, RegionName, nearestRegion, regionLabel } from './src/regions';
import { HistoryEntry, Snapshot } from './src/types';
import { Sparkline } from './src/components/Sparkline';

const METRICS: Array<{ key: HeadlineMetric; label: string }> = [
  { key: 'band', label: 'PM2.5' },
  { key: 'aqi', label: 'AQI' },
  { key: 'psi', label: '24-hr PSI' },
];

const MAP_HEIGHT = 250;

// Label render order: selected on top, Central above its W/E neighbours
// (pills sit at exact geo positions and Central is the widest).
const LABEL_ORDER = ['west', 'east', 'north', 'south', 'central'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [region, setRegion] = useState<RegionName>('central');
  const [metric, setMetric] = useState<HeadlineMetric>('band');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const snap = await fetchSnapshot();
      setSnapshot(snap);
      setHistory(await appendHistory(snap));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load readings');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setHistory(await loadHistory());
      backfillHistory().then(setHistory).catch(() => {});
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          setRegion(nearestRegion(pos.coords.latitude, pos.coords.longitude));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const reading = snapshot?.readings[region];
  const pm25 = reading?.pm25 ?? null;
  const psi = reading?.psi ?? null;
  const bandDef =
    metric === 'psi'
      ? psi != null
        ? psiBand(psi)
        : null
      : pm25 != null
        ? neaBand(pm25)
        : null;
  const theme = bandDef ? BAND_THEME[bandDef.band] : FALLBACK_THEME;

  const headline = useMemo(() => {
    if (metric === 'psi') {
      if (psi == null) return null;
      return { value: String(psi), label: '24-hr PSI · NEA' };
    }
    if (pm25 == null) return null;
    switch (metric) {
      case 'band':
        return { value: String(pm25), label: `1-hr PM2.5 · µg/m³` };
      case 'aqi':
        return { value: String(usEpaAqi(pm25)), label: 'US AQI (computed)' };
    }
  }, [metric, pm25, psi]);

  const sparkValues = useMemo(
    () => history.map((h) => h.pm25[region]).filter((v): v is number => v != null),
    [history, region],
  );
  const sparkWidth = screenWidth - 48;
  // Center on the centroid of the five regions so they sit mid-frame; tighter
  // longitude span zooms in past the full-island fit.
  const mapRegion = useMemo(() => {
    const lat = REGIONS.reduce((s, r) => s + r.labelLocation.latitude, 0) / REGIONS.length;
    const lng = REGIONS.reduce((s, r) => s + r.labelLocation.longitude, 0) / REGIONS.length;
    return {
      latitude: lat,
      longitude: lng,
      longitudeDelta: 0.5,
      latitudeDelta: (0.5 * MAP_HEIGHT) / sparkWidth,
    };
  }, [sparkWidth]);
  const toPx = useCallback(
    (latitude: number, longitude: number) => ({
      x:
        ((longitude - (mapRegion.longitude - mapRegion.longitudeDelta / 2)) /
          mapRegion.longitudeDelta) *
        sparkWidth,
      y:
        ((mapRegion.latitude + mapRegion.latitudeDelta / 2 - latitude) /
          mapRegion.latitudeDelta) *
        MAP_HEIGHT,
    }),
    [mapRegion, sparkWidth],
  );

  return (
    <LinearGradient colors={[theme.bgFrom, theme.bgTo]} style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.subtext} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.brand}>HazeLah</Text>
          {snapshot && (
            <Text style={styles.updated}>Updated {formatTime(snapshot.updatedTimestamp)}</Text>
          )}
        </View>

        <View style={styles.chips}>
          {REGIONS.map((r) => {
            const selected = r.name === region;
            return (
              <Pressable
                key={r.name}
                onPress={() => setRegion(r.name)}
                style={[styles.chip, selected && { backgroundColor: theme.color }]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {regionLabel(r.name)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : headline ? (
          <>
            <View style={styles.headline}>
              <Text style={[styles.value, { color: theme.color }]}>{headline.value}</Text>
              <Text style={styles.valueLabel}>{headline.label}</Text>
              {bandDef && metric !== 'aqi' && (
                <Text style={[styles.bandLabel, { color: theme.color }]}>{bandDef.label}</Text>
              )}
            </View>

            <View style={[styles.advisory, { borderColor: theme.color }]}>
              <Text style={styles.advisoryText}>
                {bandDef ? advisoryFor(bandDef.band) : ''}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Last 24 hours</Text>
              {sparkValues.length >= 2 ? (
                <Sparkline values={sparkValues} color={theme.color} width={sparkWidth} />
              ) : (
                <Text style={styles.hint}>Collecting readings…</Text>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: COLORS.divider }]} />

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.mapTitle]}>Regions</Text>
              <View style={[styles.mapCard, { width: sparkWidth, height: MAP_HEIGHT }]}>
                <MapView
                  style={{ width: sparkWidth, height: MAP_HEIGHT }}
                  initialRegion={mapRegion}
                  provider={PROVIDER_GOOGLE}
                  customMapStyle={DARK_MAP_STYLE}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  toolbarEnabled={false}
                >
                  {REGIONS.map((r) => {
                    const pm = snapshot?.readings[r.name]?.pm25;
                    const band = pm != null ? neaBand(pm) : null;
                    const color = band ? BAND_THEME[band.band].color : COLORS.faint;
                    const selected = r.name === region;
                    return (
                      <MapCircle
                        key={r.name}
                        center={r.labelLocation}
                        radius={5500}
                        strokeColor={withAlpha(color, selected ? 1 : 0.8)}
                        strokeWidth={selected ? 2.5 : 1.5}
                        fillColor={withAlpha(color, selected ? 0.5 : 0.32)}
                      />
                    );
                  })}
                </MapView>
                {[...REGIONS]
                  .sort((a, b) => {
                    const sel =
                      (a.name === region ? 1 : 0) - (b.name === region ? 1 : 0);
                    return sel !== 0
                      ? sel
                      : LABEL_ORDER.indexOf(a.name) - LABEL_ORDER.indexOf(b.name);
                  })
                  .map((r) => {
                    const { x, y } = toPx(
                      r.labelLocation.latitude,
                      r.labelLocation.longitude,
                    );
                    const pm = snapshot?.readings[r.name]?.pm25;
                    const band = pm != null ? neaBand(pm) : null;
                    const color = band ? BAND_THEME[band.band].color : COLORS.faint;
                    const selected = r.name === region;
                    return (
                    <Pressable
                      key={r.name}
                      onPress={() => setRegion(r.name)}
                      style={[
                        styles.mapLabel,
                        { left: x, top: y, borderColor: color },
                        selected && { backgroundColor: color },
                      ]}
                    >
                      <Text
                        style={[styles.mapLabelText, { color }, selected && { color: '#000' }]}
                      >
                        {regionLabel(r.name)}
                      </Text>
                      <Text
                        style={[styles.mapLabelValue, { color }, selected && { color: '#000' }]}
                      >
                        {pm ?? '–'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.psiRow}>
              <Text style={styles.sectionTitle}>24-hr PSI</Text>
              <Text style={styles.psiValue}>
                {psi != null ? `${psi} · ${psiDescriptor(psi)}` : '—'}
              </Text>
            </View>

            <View style={styles.metricRow}>
              {METRICS.map((m) => {
                const selected = m.key === metric;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setMetric(m.key)}
                    style={[styles.metricBtn, selected && { backgroundColor: COLORS.chip }]}
                  >
                    <Text style={[styles.metricText, selected && { color: theme.color }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>Loading readings…</Text>
        )}

        <Text style={styles.footer}>
          Data: NEA via data.gov.sg · AQI is computed, not NEA-published · Not
          affiliated with NEA
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 64 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  brand: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  updated: { color: COLORS.faint, fontSize: 12 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 24, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.chip,
  },
  chipText: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#000' },
  headline: { alignItems: 'center', marginTop: 40 },
  value: { fontSize: 96, fontWeight: '800', fontVariant: ['tabular-nums'] },
  valueLabel: { color: COLORS.subtext, fontSize: 14, marginTop: 4 },
  bandLabel: { fontSize: 22, fontWeight: '700', marginTop: 10 },
  advisory: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  advisoryText: { color: COLORS.text, fontSize: 14, textAlign: 'center' },
  section: { marginTop: 32, alignItems: 'center' },
  mapTitle: { marginBottom: 12 },
  mapCard: {
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative',
    backgroundColor: '#0c111b',
  },
  mapLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(8,9,12,0.9)',
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
  mapLabelText: { fontSize: 12, fontWeight: '700' },
  mapLabelValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sectionTitle: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  hint: { color: COLORS.faint, fontSize: 13, marginTop: 12 },
  divider: { height: 1, marginTop: 28 },
  psiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  psiValue: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  metricBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  metricText: { color: COLORS.subtext, fontSize: 13, fontWeight: '600' },
  error: { color: '#FF453A', textAlign: 'center', marginTop: 32 },
  footer: { color: COLORS.faint, fontSize: 11, textAlign: 'center', marginTop: 40 },
});
