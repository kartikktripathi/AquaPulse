# Filters for reports and map (feature 15)

Open **Filters** beneath the home screen search bar or on **Reports by Category**.
Select one or more categories, severity, status, reported date and area, then press
**Show reports**. The applied selection is shared between these two screens during
the app session. Closing the sheet cancels draft changes; **Reset all** resets the
draft, while the toolbar's clear button immediately clears every applied filter.

- Categories match any selected category. Different filter groups must all match.
- Date presets include today and the preceding 6 or 29 calendar days. Today starts
  at local midnight. Custom `YYYY-MM-DD` ranges include both dates in the device's
  timezone; missing, impossible or reversed dates cannot be applied.
- Area search matches every entered word against address lines and landmarks,
  ignoring case and surrounding spaces.
- Old category IDs and status aliases (`resolved`, `verified`) are supported.
  Reports without severity remain visible under **Any severity** and **Not recorded**.
- The map uses category-colored saved report markers, a legend and safe text
  popups. **Fit reports** frames the matching markers. **View list** opens the
  same results. Reports without valid coordinates are counted separately and
  remain available in the list.
- Filters never move the user's GPS marker, 500 m reporting zone or draft pin.
  Place search pans the map without changing the user's reporting location.
- Focus, refresh and successful report submission reload the shared Supabase
  snapshot. Failed refreshes show a notice and keep the last available results.

## Implementation and current scope

`ReportExplorerContext` owns the shared report snapshot and applied filters.
`reportFilters.js` owns the pure matching/date/marker helpers. `ReportFilters.jsx`
provides a reusable sheet and toolbar. The existing Leaflet document now lives in
`mapHtml.js`; `SET_REPORTS` replaces only its saved-report layer and `FIT_REPORTS`
adjusts the viewport. User-controlled popup content is inserted with `textContent`.

This implementation uses the project's existing direct Supabase connection and
paged snapshot reader (500 rows per request), then filters the complete snapshot
on the client. It does not add an Express API, SQL WHERE filtering, a new database
column or a district picker. The current Report schema has no district/ward IDs;
structured district filtering and server-side filtered pagination depend on that
future backend work. Address search is available now. Nearby Reports retains its
separate distance/category/resolved controls. Applied filters reset on app restart.

## Verification

Run `npm test` for nearby, Supabase, filtering and embedded-map tests. The filter
tests cover combined selections, old values, invalid coordinates, calendar
boundaries, inclusive ranges and daylight saving time. The map tests execute the
embedded JavaScript with a Leaflet/DOM double to check marker replacement, empty
results, separate draft/GPS layers and safe popup content.

Manual checks: apply two categories on the map, open the list, add an area filter,
go back to the map, cancel draft changes, reject a reversed date range, and clear
all filters. Confirm matching counts and markers, including zero results.
Build with `CI=1 EXPO_OFFLINE=1 npx --no-install expo export --platform all`.
