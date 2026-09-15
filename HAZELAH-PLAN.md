# HazeLah — SG Haze, PSI & PM2.5

Living plan document. Keep in sync: every plan change agreed in chat is folded in here in the same session. Change log at the bottom.

## 1. Product definition

A simple, beautiful Singapore air-quality app: glanceable haze readings, threshold-crossing push notifications, iOS widgets, Apple Watch complications. iOS + Android phones.

- Non-monetized (craft project, not a business).
- Positioning: the gap left by Haze@SG (plain, no watch) and SG Air (stale since Oct 2023, dated UI). Nobody owns "modern, beautiful, glanceable."
- Differentiators: crossing-only alerts (no hourly spam), NEA-band-anchored advisories, genuinely nice widget/complication design.

## 2. Competitive landscape (as of Sep 2026)

| App | Status | Widget | Watch | Push | Notes |
|---|---|---|---|---|---|
| Haze@SG (Hosay Studios) | Active, 4.5★/124, #2 Weather SG | ? | no | alerts | Incumbent brand since 2013; SGD 1.99/mo sub |
| SG Air | Stale (v2.08, Oct 2023), 3.0★/2 | yes | yes | hourly | Feature-complete but abandonware; "visual acne" per reviews |
| SG Real PSI | Dormant | no | no | no | Hourly PSI from PM2.5, no ratings |
| Hazel (Clean Shaven) | Minimal | no | no | hourly | Name adjacency to HazeLah noted; low risk |
| myENV (NEA official) | Active | yes | no | yes | Free, comprehensive, no design love |
| IQAir / AirVisual | Active | yes | yes | yes | Global tier; do not compete on data |

## 3. Data sources

| Source | Endpoint | Content | Refresh |
|---|---|---|---|
| data.gov.sg (NEA) | `api-open.data.gov.sg/v2/real-time/api/pm25` | 1-hr PM2.5 µg/m³, 5 regions | 15 min |
| data.gov.sg (NEA) | `api-open.data.gov.sg/v2/real-time/api/psi` | 24-hr PSI, 5 regions | 15 min |

- Free for commercial use under the Open Data Licence; no API key for basic rate limits (key raises limits). Dataset pages: `d_e1058d6974c877257e32048ab128ad83` (PM2.5), `d_fe37906a0182569d891506e815e819b7` (PSI).
- NEA does not publish a 1-hour index — only 1-hr PM2.5 concentration + 24-hr PSI. All "hourly AQI/PSI" in third-party apps is computed client-side.

### Legacy v1 API (unofficial backfill source)

The pre-2025 API family `api.data.gov.sg/v1/environment/*` is deprecated but still serving (verified Sep 2026). v2 has no history, so the app backfills the 24-h sparkline from it (`fetchDayPm25` in `src/api.ts`).

- Query modes: no params → latest; `date=YYYY-MM-DD` (SGT day) → full day, hourly (only up to current hour); `date_time=YYYY-MM-DDTHH:00:00` → nearest single item.
- Endpoints verified: `psi` (hourly, 12 reading families incl. `psi_twenty_four_hourly`, `pm25_sub_index`, `pm25_twenty_four_hourly`), `pm25` (hourly `pm25_one_hourly` per region), `uv-index`. Same `date`/`date_time` semantics across the family (`2-hour-weather-forecast`, `rainfall`, `air-temperature`, …) — available if widgets need context data later.
- Shape: flat envelope (no `code`/`errorMsg` wrapper), field names differ slightly from v2 (`update_timestamp` vs `updatedTimestamp`). Timestamps are `+08:00` with ~11-min publication lag after the hour.
- Keyless, no documented rate limit. App hits it at most twice per launch (yesterday + today), merged idempotently into AsyncStorage history.
- Fails soft: any error returns `[]` and the sparkline reverts to slow accumulation from live polling. If the endpoint dies, only the backfill is lost.

## 4. Index computation (client module, ~50 lines)

Three breakpoint tables, all applied to the 1-hr PM2.5 concentration:

1. **NEA 4-band scale** (official; drives color + advisory copy):
   - Normal 0–55 / Elevated 56–150 / High 151–250 / Very High ≥251
2. **US EPA AQI** (piecewise linear; e.g. 12.1–35.4 → 51–100):
   - 0–12.0 → 0–50, 12.1–35.4 → 51–100, 35.5–55.4 → 101–150, 55.5–150.4 → 151–200, 150.5–250.4 → 201–300
3. **SG PSI sub-index** (NEA's official segmented-linear formula, PM2.5 row; from haze.gov.sg "Computation of the PSI" PDF):
   - `I = (I_hi − I_lo)/(X_hi − X_lo) × (X − X_lo) + I_lo`
   - Breakpoints 0–12 → 0–50, 13–55 → 51–100 (worked example: 40 µg/m³ → 83)
   - Note: true PSI is max of 6 sub-indices; PM2.5-only is a haze-season proxy — footnote in About.

Presentation: NEA band primary; toggleable headline: 1-hr PM2.5 / US AQI (computed) / **24-hr PSI (official, like Haze@SG & myENV)**. When 24-hr PSI is selected, theme + advisory derive from official PSI tiers (≤100 → Normal, 101–200 Unhealthy → "reduce", 201–300 Very Unhealthy → "avoid", >300 Hazardous → "minimise") so guidance stays aligned with NEA/MOH. `sgPsiSubIndex` (computed hourly PSI) stays in the module but is not surfaced on the phone — NEA disclaims computed hourly indices: "not supported by any studies or health findings". About screen: "Not affiliated with NEA" + PM2.5-proxy footnote.

## 5. Architecture

```
NEA APIs ──direct fetch──► Expo app (RN+TS, iOS+Android)
        ──direct fetch──► iOS WidgetKit ext (Swift, native target)
        ──direct fetch──► watchOS app + complications (Swift, native target)
        ──direct fetch──► Android Glance widget (Kotlin, native target)
        ──15-min cron───► Cloudflare Worker (KV) ──Expo Push API──► devices
```

Key property: every surface fetches NEA directly (one GET + JSON parse each). Zero backend for the core app; the Worker exists only for push.

## 6. Phone app (Expo + React Native + TypeScript)

- One screen, no tabs: big 1-hr PM2.5 number, band-colored background (dark-mode-first gradient), region name, 24-hr sparkline, 24-hr PSI secondary line, one health-advisory line ("Masks recommended outdoors").
- Region resolution: silent permission read (`getForegroundPermissionsAsync`, no prompt on launch) → nearest-centroid match against NEA regionMetadata labelLocations (no geocoding API); manual region chips; opt-in "locate me" deferred to M2.
- History: AsyncStorage ring buffer + first-launch backfill via `date` param.
- Refresh: pull-to-refresh, silent on foreground, background fetch as widget fallback.
- Settings: notification threshold (band or PSI value), region override, AQI/PSI display toggle.

## 7. iOS widgets (native Swift WidgetKit target)

- Lock Screen: circular, rectangular, inline (`PM2.5 89 · High`).
- Home Screen: small + medium. StandBy + tinted rendering.
- Timeline refresh every 15 min, direct API fetch.
- Lives in `ios/` after `expo prebuild`, committed to repo.
- **Prebuild discipline** (native targets live only in `ios/`/`android/`):
  1. `expo prebuild` once, then commit `ios/` + `android/` immediately.
  2. **Never** `prebuild --clean` — deletes widget extension and watch app. Fix native builds by editing native files directly.
  3. Plain `prebuild` = config-change tool only, not a fix-it tool.
  4. Expo SDK upgrade: prebuild on scratch branch, diff, port changes into committed native projects by hand.
  5. Express config in `app.json`/config plugins where possible so upgrade diffs stay meaningful; hand-edit only what plugins can't do (watch target, extension wiring).

## 8. Apple Watch (native Swift target)

- One-screen watch app mirroring phone UI.
- Complications: `accessoryCircular`, `accessoryRectangular`, `accessoryCorner`.
- Independent fetch — no WatchConnectivity dependency; works standalone on cellular.
- Wear OS: skipped for v1 (decided).

## 9. Android widget (native Kotlin Glance)

Two sizes, band-colored background, tap-to-open, self-contained fetch.

## 10. Push notifications (only infrastructure)

Cloudflare Worker, cron `*/15 * * * *`, deployed via `wrangler` from `worker/` in the same repo:

1. Fetch PM2.5 + PSI.
2. Diff against previous reading in Workers KV.
3. On band change / threshold crossing, fan out via Expo Push API (covers iOS via APNs + Android via FCM; no Firebase console).

Endpoints: `POST /register` (Expo token + threshold + region), `POST /unregister`. Prune tokens on `DeviceNotRegistered`.

Alert philosophy: crossing-only ("Air just turned Unhealthy in Central SG"). No hourly pings.

### Detailed design

**Client flow (registration):**
- Notification permission is requested only when the user enables alerts in settings (not on first launch).
- On enable: `expo-notifications.getExpoPushTokenAsync()` → `POST /register` with `{ token, threshold, region }`.
- Threshold/region changes → re-`POST /register` (idempotent upsert). Disable → `POST /unregister`.

**KV schema (two keys):**
- `latest` → JSON `{ pm25: {region: val}, psi: {region: val}, fetchedAt }` — written only when values change (write-on-change, ~24/day).
- `tokens` → JSON array of `{ token, threshold, region, registeredAt }` (single key, ≤25 MiB → ~250k tokens capacity).

**Detection semantics (per cron tick):**
1. Fetch both endpoints; if fetch fails → exit silently (retry next tick; never notify on stale data).
2. Diff per-region values against `latest`:
   - Band change (NEA 4-band) in any region, or
   - User threshold crossed in a region (PSI or PM2.5-based, per user pref).
3. **Hysteresis / flap guard**: only fire when crossing *up* into a band, or 2 consecutive ticks stable when crossing down — haze readings flap; prevent alert ping-pong.
4. Recipients = tokens whose `region` matches an affected region and whose `threshold` is met. Batch ≤100 tokens per Expo Push POST.

**Notification payload:**
```json
{
  "title": "Haze lah",
  "body": "Central SG just turned Unhealthy (PSI 103)",
  "data": { "region": "central", "metric": "psi", "value": 103, "screen": "main" },
  "sound": "default"
}
```
Deep-links to the main screen via `data.screen`.

**Receipt hygiene:** after fan-out, check Expo push receipts (batch endpoint); remove tokens reporting `DeviceNotRegistered`; log other errors to console (Cloudflare dashboard tail).

### Free-tier verification (checked against Cloudflare docs, Aug/Apr 2026)

| Dimension | Free limit | Worst-case usage | Headroom |
|---|---|---|---|
| Worker requests (cron counts) | 100,000/day | ~200/day | ~500× |
| CPU | 10 ms/invocation | ~1–2 ms (2 fetches; network wait ≠ CPU) | fine |
| KV reads | 100,000/day | ~192/day | ~500× |
| KV writes | 1,000/day | ~100/day → **~24/day with write-on-change** | ~10× / 40× |
| KV list ops | 1,000/day | 0 (tokens under one JSON key) | n/a |
| Storage | 1 GB | ~100 B/token → millions | fine |

- Overages hard-fail (errors until 00:00 UTC reset), never bill. Worst case: notifications pause briefly.
- Scaling caveats: Expo Push ≤100 tokens/POST → chunk fan-out past ~5k devices; Workers Paid is $5/mo flat (10M req/mo, 1M KV writes/mo) if ever needed.
- Alternatives considered: Deno Deploy (equivalent), Lambda+EventBridge+DynamoDB (more ceremony), GitHub Actions cron (unreliable 10–60 min delays — rejected), local-only BGTaskScheduler/WorkManager (iOS can be hours late — rejected).

### Dev builds (physical iPhone)

- EAS project linked: `@sfdye/hazelah` (expo.dev/accounts/sfdye/projects/hazelah). `expo-dev-client` installed.
- Cloud build: `npx eas build -p ios --profile development` (interactive: Apple ID sign-in + device registration, then install via the link/QR EAS prints, or `npx eas build:run -p ios`).
- Local build alternative: plug iPhone in via USB → `npx expo run:ios --device` (uses existing local "Apple Development: Liuyang Wan (APK283H24B)" cert; free-team profiles expire in 7 days).
- Android: dev build as installable APK (`buildType: apk` in the development profile). No Google Maps key needed — the region map is self-drawn SVG (see decision log).

## 11. Naming & store compliance

- **Name: HazeLah** (7 chars; survives icon-label truncation; unique — no collisions found on either store).
- **Subtitle: "SG Haze, PSI & PM2.5"** — subtitle carries ASO keywords; Apple indexes name + subtitle.
- Notification voice: "Haze lah — Central just hit Unhealthy."
- Compliance posture: "Not affiliated with NEA" disclaimer, advisories from official NEA bands, no "official" wording, accurate screenshots.
- Apple guidelines to respect: 2.3.7 (unique name ✓), 2.3.10 (**no Android/Google Play references in iOS metadata/binary** — cross-platform hygiene), 5.2 (no trademarked terms). Play: ≤30-char title, no impersonation of government body. Hazel (Clean Shaven) name adjacency = accepted low risk.
- 5-min pre-commit checks: App Store exact-name search + `hazelah.sg`/`.com` domain + IPOS trademark (optional).

### App identifiers (irreversible after first store publish — decide now)

| Surface | Identifier |
|---|---|
| iOS bundle ID + Android package | `com.sfdye.hazelah` |
| iOS widget extension | `com.sfdye.hazelah.widget` |
| Watch app | `com.sfdye.hazelah.watchkitapp` |
| Watch complication extension | `com.sfdye.hazelah.watchkitapp.widget` |
| App Group (widget/app shared data) | `group.com.sfdye.hazelah` |
| npm package name | `hazelah` |

Personal project → `sfdye` handle segment, not `lwan` (Zendesk identity). Watch app ID must be prefixed by the main app's ID (satisfied); Android package is the permanent Play Store URL slug.

## 12. Milestones

| # | Scope | Output |
|---|---|---|
| 1 | Expo scaffold, API spike (confirm JSON shapes), typed client, breakpoint module, main screen, region mapping, sparkline | Running app on both simulators |
| 2 | iOS WidgetKit + watchOS targets, Android Glance widget | All glance surfaces live |
| 3 | Worker + register/unregister, settings, advisory copy, disclaimers, polish, TestFlight + Play internal track | v1 shipped |

## 13. Risks

- Expo + native targets: fine with dev client; discipline around `prebuild` (§7).
- API schema drift: spike first in milestone 1.
- Seasonal utility: downloads spike with haze events — acceptable, monetization is a non-goal.
- Push latency: worst case one 15-min cron tick.
- Free-tier limits: verified sufficient; overages fail safe (§10).

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-15 | Build it | Gap in market for craft/glanceability; non-monetized |
| 2026-09-15 | React Native + Expo over Flutter/native-both | User choice; Expo handles push/build infra well |
| 2026-09-15 | Skip Wear OS for v1 | Apple Watch dominates SG share; scope control |
| 2026-09-15 | Cloudflare Worker + Cron + KV for push | Fewest moving parts; free tier verified with 2–3 orders of magnitude headroom |
| 2026-09-15 | NEA 4-band scale as primary metric | Official + health-advisory basis; computed AQI/PSI toggles only |
| 2026-09-15 | Name: HazeLah | Short, local, ownable; store-review risk assessed as low |
| 2026-09-15 | Identifiers: `com.sfdye.hazelah` base | Personal project → sfdye handle; watch/widget/App-Group suffixes hang off this base; irreversible post-publish so locked early |
| 2026-09-15 | No location prompt on cold launch; silent read + manual chips (M1 verified) | Cold-launch permission prompts are an anti-pattern; Expo Go also surfaces its own dialog — M2 adds opt-in "locate me" |
| 2026-09-15 | M1 done: Expo SDK 57 scaffold + data layer + main screen live on iOS simulator (real NEA data verified) | API spike confirmed shapes: psi → `psi_twenty_four_hourly` + sub-indices; pm25 → `pm25_one_hourly`; regionMetadata has labelLocation |
| 2026-09-15 | Region map added, haze.gov.sg-style: dark Apple Maps + band-colored zone Circles + overlaid name/value labels (RN views projected from lat/lng) | react-native-maps 1.27 Fabric Marker doesn't render custom children — native Markers replaced by projected RN overlays; static map (pan/zoom off) keeps projection exact |
| 2026-09-15 | 24-h sparkline backfilled from NEA legacy v1 endpoint (`api.data.gov.sg/v1/environment/pm25?date=`), merged into the live-polled history on launch | v2 realtime API has no history; polling alone takes ~a day to accumulate a trend. Legacy v1 still serves full-day hourly readings — treat as unofficial, fail soft (empty array) |
| 2026-09-15 | PSI headline tab switched from computed hourly PSI to the official 24-hr PSI (per user; matches Haze@SG/myENV); theme + advisory now derive from the selected metric | Computed hourly PSI duplicated the AQI tab's job (same 1-hr PM2.5 input, different scale), and NEA health advisories are officially keyed to 24-hr PSI |
| 2026-09-15 | Region map rewritten as real map (react-native-maps restored): full-card-width, framed exactly to Singapore, labels back at true geo positions as compact single-line pills; Carto dark raster tiles via UrlTile on Android | SVG-only basemap rejected by user (wants a real map); pill pixel math tied to the view aspect (latDelta derived from card size) so labels match the map exactly; iOS Expo Go ignores userInterfaceStyle and won't render UrlTile (iOS 26) — Apple Maps standard stays on iOS, revisit in dev build; Android keeps UrlTile over the keyless Google canvas |
| 2026-09-15 | Same map provider on both platforms: Google Maps everywhere (`provider={PROVIDER_GOOGLE}` + dark `customMapStyle`); Carto/UrlTile and Apple Maps removed; app.json has key placeholders (PASTE_IOS_KEY / PASTE_ANDROID_KEY) | User wants identical map on iOS + Android; Expo Go on iOS cannot render the Google canvas at all — map must be verified in a real dev build; needs a Google Maps API key (free for native mobile map loads, but requires a Cloud project with billing enabled; keys restricted by bundle id `com.sfdye.hazelah` / android package) |
