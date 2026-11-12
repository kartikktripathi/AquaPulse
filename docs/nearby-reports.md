# Nearby Reports

**Current default: local demo mode.** No server or database is required for report
submission or lists. Reports persist in browser site storage or native app document
files. The API integration described below applies only when
`EXPO_PUBLIC_REPORT_MODE=api`; see the README for switching modes. Demo reports do
not automatically migrate to the backend. Location permission is still required
to calculate nearby distances.

Open the hamburger menu on the home map and choose **Nearby Reports**.
The screen requests foreground device location and lists saved reports nearest
first, with radius choices of 500 m, 1 km, 5 km and 10 km. Category filtering and
an Include resolved switch narrow the list. Pull down to refresh location and data.

The browsing radius is independent of the existing 500 m new-report restriction.
Distances are approximate straight-line distances, not walking/driving routes.
Only foreground location is requested. Browsing calculates distances on the device
and does not send the user's GPS coordinates to the reports API.

## Integration

- The screen consumes the existing `GET /api/reports` endpoint using the platform
  candidates already defined in `reportService.js`.
- The required response is `{ "success": true, "reports": [...] }`.
- Both flat `latitude`/`longitude` and nested `coordinates` objects are supported.
  Numeric strings are accepted. Invalid/missing coordinates are excluded and counted.
- Legacy category IDs work; `fixed` and `resolved` both count as resolved.
- The optional `getReportsSnapshot({ signal })` API reports whether data came from
  the network or in-memory cache. Existing `getReportsFromDatabase()` callers still
  receive an array. Failed POST submission behaviour is unchanged.
- A successful empty response shows an empty search. Failed loading with no cache
  shows service-unavailable. Previously fetched data is clearly marked as cached.
- The cache lasts only for the running app session. It is not persistent storage.
- Filtering covers the fetched list. If the backend introduces pagination, implement
  a server radius query or fetch all pages before claiming complete nearby coverage.

The current checkout has no Express server. To show real shared reports, the team
must supply this endpoint with persisted reports and usable GPS coordinates.
This feature does not create, confirm, or deduplicate reports. The pre-submission
duplicate warning from Feature 11 remains a separate task.

## Verification

Run the tests with Node 22.7+ (automatic ESM detection) or the project's Node 26:

```bash
npm run test:nearby
```

Tests cover coordinate validation, exact radius boundaries, stable sorting,
legacy/category/status mapping, photos, immutability, network/cache/empty states,
request cleanup/cancellation, permission denial, disabled GPS, and GPS timeout.
Node may report VM Modules and automatic module-detection warnings; the tests use
VM modules to mock React Native and Expo APIs without installing a test framework.

Build web using installed dependencies:

```bash
CI=1 EXPO_OFFLINE=1 npx --no-install expo export --platform web --output-dir /private/tmp/aquapulse-nearby-web-check
```

ESLint is not configured in this repository. Running `expo lint` would attempt to
install tooling; it was not used for this feature.

Manual checks on a phone/browser with a running API:

1. Open Nearby Reports from the sidebar, then go back; also check Reports by Category.
2. Allow GPS; check sorted distances and all four radii with known report locations.
3. Select a category, enable resolved issues, reset filters, and pull to refresh.
4. Deny permission, disable device location, and leave GPS waiting: check recovery.
5. Stop the API after a successful load: cached reports must be marked as such.
6. Restart the app with the API offline: show unavailable, not an empty successful search.
7. Return an empty successful list: show no reports within the radius.

In the development browser, the route, sidebar navigation, radius selection, back
navigation, timeout recovery view, and layout at 320 px were checked. A live GPS fix
and real backend results require a permitted device and the team's running API.

The original implementation prompt is in [nearby-reports-prompt.md](nearby-reports-prompt.md).
