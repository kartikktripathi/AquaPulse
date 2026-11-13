# Nearby Reports with the shared Supabase backend

Nearby Reports has been restored on top of Kartik's `bce9206` Supabase pipeline.
The app saves to `public."Report"` and uploads photos to the `report-photos` bucket
through the public Supabase client. It does not use the old local demo mode or
require an Express server for this flow.

## Local configuration

Create an ignored `.env` using `.env.example`. Four settings serve two different
purposes:

| Setting | Used by |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Expo app's Supabase HTTPS client |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Expo app's public anon/publishable key |
| `DATABASE_URL` | Server-side Prisma/PostgreSQL tooling, transaction pooler |
| `DIRECT_URL` | Prisma schema/migration tooling, session pooler |

The database URLs alone do not configure the Expo Supabase client. Never prefix
database passwords or service-role keys with `EXPO_PUBLIC_`. The mobile/web app
uses only the public key and the project's configured database/storage permissions.
An admin/service-role fallback is not included in the client bundle.

After changing `.env`, stop the old Expo process and restart:

```bash
npx expo start --clear
```

## Behaviour

- Hamburger menu → Nearby Reports: foreground GPS, nearest-first reports, 500 m /
  1 km / 5 km / 10 km browsing radii, category chips and Include resolved toggle.
- The existing 500 m creation limit remains; form submission needs valid location.
- Radius calculations use full precision before distance labels are rounded.
- Invalid/missing coordinates are excluded and counted. Both legacy nested and
  current flat coordinates/categories are supported.
- Reports are fetched from Supabase in pages to avoid the default response limit
  silently hiding nearby reports. Category-wise Reports shares the same service.
- Revisiting either list refreshes it; pull-to-refresh refreshes nearby GPS/data.
- Previously loaded shared reports can be shown with a stale-data label on failure.
  A failed insert never creates a fake local report. A failed photo upload stops
  submission with an error so local file URIs are not saved as shared evidence.
- Nearby browsing supports discovery/filtering. It does not implement the separate
  pre-submission duplicate warning or confirmation features.

## Verification

```bash
npm run test:nearby
npm run check:backend
```

The first command runs isolated regression tests without modifying Supabase. The
second makes a zero-row Report query to verify live connectivity without reading
report content. For an explicit write/read/delete check against the shared database:

```bash
node scripts/check-report-write.mjs --write
```

That last command creates one labelled test row and removes only that row after
read-back. It does not test a real photo upload or alter schema/policies.

Verified on November 13, 2026: live Report access, photo-bucket read access, and a
temporary report save/read/delete cycle all passed. The temporary row was removed.

## Shared schema

Kartik's `9fddfe9` adds `waterDepth`, `peopleAffected`, `roadBlocked`, and `severity`
to the Prisma model and the report read/write payload. The restored feature
preserves all four fields. Ensure the shared Supabase table has the matching
columns before submitting; at the earlier connection check it still lacked
`severity`. This Git integration does not apply migrations to the shared database.

The direct PostgreSQL pooler connection rejected certificate verification with
`SELF_SIGNED_CERT_IN_CHAIN` on this machine. TLS verification was not disabled.
Prisma tooling needs the correct trusted CA configuration; the app's verified
Supabase HTTPS save/read flow does not use that pooler connection.
