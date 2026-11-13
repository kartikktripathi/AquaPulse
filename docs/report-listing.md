# Functional report listing

Open **All Reports** in the sidebar or **View list** on the map. The listing reads
the existing Supabase report snapshot and uses the same category, severity,
status, date and area filters as the map. No schema changes are required.

- Search the list by title, description, category, address or landmark. All search
  words must match, ignoring case. Search applies only to the current list; the
  filter toolbar still shows the number of reports matching the shared filters.
- Sort by newest, oldest or highest severity. Severity ties use newest first;
  missing dates and unrecorded severity sort last. Original report data is unchanged.
- Tap any card to open its full description, category, status, severity, address,
  landmark, report date, water depth, people affected, road access, reported
  coordinates, report ID and photo gallery. Unknown fields are labeled as such.
- Close the modal with its close button, backdrop, Android Back or **Back to reports**.
  Search, sorting, applied filters and list position are retained.
- Refresh using the header button or pull-to-refresh. Loading, failed connection,
  cached results, no reports and no search matches have separate states.
- **Reports by Category** uses the same list, cards and details, with its existing
  category shortcuts. The sidebar scrolls on shorter screens.

`ReportsScreen` is shared by `/reports` and `/reports-by-category`.
`ReportCard`, `ReportDetailsModal` and `ReportPhoto` provide the reusable views.
`reportListing.js` handles search, sorting, safe photo selection and detail labels.
The existing service fetches all pages (500 records per request); FlatList renders
visible cards in batches. This is client-side search/sorting, not server-side
search or incremental API pagination. The detail modal uses the loaded report
snapshot and never changes reports or requests the viewer's GPS location.

Run `npm test` for listing, filter, map, nearby and service checks. For UI checks,
open All Reports, search for a known title/address, switch sort order, open and close
a card, browse its photos, clear a search with no matches, and refresh. Verify the
category route still filters and opens the same details. Native bundle exports
are build checks; device interactions need Expo Go or a simulator.
