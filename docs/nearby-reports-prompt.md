# Implementation prompt: Nearby Reports

Act as a senior React Native / Expo engineer working in the existing AquaPulse
team repository. Inspect the current files before implementing this feature.
Deliver working code and verification, using the project's existing dependencies.

## Project context

AquaPulse is a citizen water-issue reporting app using React Native, Expo Router,
JavaScript/JSX, Ionicons, and Expo Location. The home screen embeds a Leaflet map
inside a native WebView or web iframe. It already has GPS, location search, a draft
report pin, a 500 m submission zone, a report modal, and an animated sidebar.

Existing files:

- `src/app/index.jsx`: home map and sidebar, including Reports by Category.
- `src/app/_layout.jsx`: Stack with hidden headers and explicit screen entries.
- `src/app/reports-by-category.jsx`: category list, status/severity/date filters,
  loading/empty/error views, and pull-to-refresh. Preserve its behaviour.
- `src/services/reportService.js`: platform-aware `/api/reports` GET/POST client.
  GET currently returns an in-memory cache when unavailable. POST correctly
  reports failed submissions. Preserve existing callers and submission behaviour.
- `src/utils/categoryMeta.js`: five fixed categories, legacy category mapping,
  status colours, photo parsing, address helpers, and date formatting.
- `src/utils/geo.js`: Haversine distance and reverse geocoding helpers.
- `src/utils/severity.js`: Low/Medium/High severity metadata.
- `src/components/ReportModal.jsx`: teammate's submission and severity work.

There is currently no Express server in this checkout. Prisma scaffolding exists,
but do not build a backend or change the database as part of this frontend task.
Do not claim successful live persistence or invent reports for the demonstration.

## Scope and feature alignment

Build a dedicated Nearby Reports screen reachable from the hamburger sidebar.
This supports report discovery (Feature 1) and filtering (Feature 15), and prepares
the location-query building block for Feature 11. It does not complete Feature 11:
the pre-submission duplicate warning, similarity rules, and confirmations are
separate work. Do not describe browsing nearby reports as duplicate prevention.

## Data contract

Use the existing `GET /api/reports` response `{ success: true, reports: [...] }`.
Reports may contain flat `latitude`/`longitude` and `addressLine1`/`landmark`, or
legacy nested `coordinates: { latitude, longitude }` and `address: { line1,
line2, landmark }`. Photo fields may be arrays or JSON strings and may contain
Base64 data URIs. Some rows may have missing or malformed values.

## Required behaviour

1. Add a sidebar item "Nearby Reports", subtitle "Find water issues around you",
   location icon, and route `/nearby-reports`. Register the screen in the Stack.
   Navigate after the drawer closes, without leaving its overlay over the screen.
2. Request foreground location using Expo Location. The centre must be the actual
   device location, never the location search result, draft pin, or an invented
   fallback. Request no background permission. Bound GPS waiting so it cannot
   leave the screen spinning forever. Ignore late results after leaving the screen.
3. Provide clear states for location permission denial, permanently denied
   permission (with native Settings action), disabled GPS, location failure, and
   retry. On web, explain browser location settings and secure-context limitations
   when relevant. Pull-to-refresh rechecks both location and reports.
4. Offer radius chips 500 m (default), 1 km, 5 km, and 10 km. These are browsing
   distances; keep the existing 500 m report-submission restriction intact.
5. Calculate great-circle distance locally from fetched report coordinates using
   Haversine. Compare the full-precision distance with the radius before rounding
   for display. Support valid numeric coordinate strings; reject null/blank,
   boolean, nonfinite, and out-of-range coordinates. Never treat missing GPS as
   a report at zero distance. Show how many rows lack usable locations.
6. Sort nearest first with stable tie ordering. Do not mutate fetched reports.
   Show metres below 1 km and kilometres above it. Clarify that distances are
   approximate straight-line distances, not driving routes.
7. Reuse category metadata, including legacy category IDs. Include All Categories
   and Other so older reports remain discoverable. Add an "Include resolved"
   switch, off by default. Treat both `fixed` and `resolved` as resolved.
8. Show report cards with category colour/icon, title, distance, friendly status,
   optional severity, address/landmark, date, short description, and an optional
   first usable photo. Handle invalid images gracefully. Missing text must have
   readable fallbacks. Do not make cards appear tappable without an action.
9. Display loading, refresh, empty-radius, empty-filter, and retryable error views.
   Provide reset-filters and return-to-map actions. Reset must clear both category
   and resolved filters. Preserve radius when resetting category/status filters.
10. Distinguish a successful empty server response from an unavailable service.
    If cached data exists, label it as previously loaded data with a retry action;
    if no cache exists, show service-unavailable, not "no reports nearby".
    Add an opt-in snapshot API to the existing service if necessary, preserving
    `getReportsFromDatabase()`'s array return. Clear request timeout handles in
    `finally` and support cancellation for this screen. Do not change POST logic.
11. Use safe areas, FlatList, RefreshControl, readable wrapping, and accessible
    labels/selected states. Match the blue/white/grey AquaPulse visual style.
    Keep the screen usable at 320 px width and on wide Expo web windows.
    Label low GPS accuracy and avoid uploading the user's location just to browse.

## Engineering constraints

- Use functional components and hooks; remain in JavaScript/JSX.
- Add small reusable pure helpers for coordinate normalization/filtering/sorting.
- Avoid new dependencies, global state libraries, fake production data, and
  duplicate API base-URL configuration.
- Preserve the map, report form, category screen, submission failure handling,
  database scaffolding, and other team members' changes.
- Do not implement authentication, confirmations, report details, navigation apps,
  saved report map markers, or the pre-submission duplicate-warning workflow.

## Acceptance and verification

- Verify navigation from the sidebar and back to the map.
- Exercise allowed/denied location, GPS timeout, empty server result, unavailable
  API, cached fallback, refresh, all radii, category filtering, and resolved toggle.
- Test nested/flat coordinates, numeric strings, invalid/missing values, radius
  edges before rounding, ordering, and source-array immutability with Node tests.
- Test service success/cache/unavailable/cancellation while preserving the legacy
  array-return contract. Mock external systems only in tests, not in app code.
- Run an offline Expo web export to check bundling. Use existing lint tooling if
  configured; do not let Expo auto-install dependencies merely to run a review.
- Report files changed, commands/results, and live-service/device limitations.
