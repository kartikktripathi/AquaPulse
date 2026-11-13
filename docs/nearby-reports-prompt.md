# Restoration prompt

Act as a senior React Native / Expo engineer in the AquaPulse team repository.
Restore Nearby Reports on top of the current shared Supabase submission pipeline.

Read the current code first. Preserve the teammate's direct Supabase `Report` table
and `report-photos` bucket integration; do not restore local demo mode as the default
or replace this integration with an unimplemented Express endpoint.

Restore the `/nearby-reports` route, Stack registration, and sidebar item. Use
foreground device GPS, exact Haversine radius filtering, nearest-first sorting,
500 m/1 km/5 km/10 km radius controls, category chips, resolved filtering, readable
report cards, safe photos, and pull-to-refresh. Preserve the separate 500 m creation
constraint. Handle permissions, GPS timeout, invalid coordinates, legacy report
formats, empty results, unavailable service, and labelled cached data. Refresh when
the route gains focus and ignore async results after leaving it.

Extend the existing Supabase service with a snapshot result containing reports,
network/cache/unavailable source, timestamp, and an actionable error. Keep existing
array-return list callers compatible. Page report reads so radius filtering covers
all fetched records. Failed writes must not appear as saved reports. Failed photo
uploads must not silently store a local URI. Use only a public anon key in Expo;
keep database credentials in the ignored environment for server-side tooling.

Configure `.env` locally and commit only `.env.example` with placeholders. Verify
the live schema before adding fields. Do not mutate the shared schema or policies
without a separately agreed migration. Explain any remaining schema mismatch.

Verify pure distance/filter logic and service success/failure/cache/pagination/
cancellation with isolated tests. Run Expo exports for web/iOS/Android. Check live
Supabase connectivity and, when authorized, one clearly labelled temporary report
save/read/delete cycle. Report exact verification and limitations; never claim
untested photo uploads or physical-device GPS passed.
