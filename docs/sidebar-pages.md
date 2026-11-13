# Sidebar pages

All three former placeholders now have Expo Router destinations.

- `/alerts`: open community reports, sorted by severity, with high-severity and
  supply-related filters, address/landmark search, refresh, cached/error/empty
  states and full report details. Uses the existing shared Supabase snapshot,
  independent of map filters. Resolved and unknown statuses are excluded.
- `/helpline`: India emergency assistance and a clearly scoped Pune municipal
  contact. Call buttons first show the service, region and number, then open
  `tel:` only after the user selects Open dialer. Cancellation never opens it.
  No phone calls are made automatically. Numbers remain selectable when a device
  lacks calling support; failed links show a message. Official sources and the
  date checked are shown in the app.
- `/about`: mission, usage instructions, app version from Expo configuration,
  permissions, shared report data and limitations, plus links to working screens.

Contact sources checked 13 November 2026:
- https://www.mha.gov.in/emergency-response-support-system-erss (112)
- https://divcompune.maharashtra.gov.in/en/helpline/ (PMC 1800-1030-222)

Scope: there is no official outage feed or municipal integration in this project.
The alerts screen does not invent schedules, restoration times, verified incidents
or push notifications. Community reports are labelled accordingly, and the Pune
authority website is linked for official information. PMC is not automatically
selected from GPS and is not presented as serving other municipalities.

Next project milestone: agree on supported municipalities, obtain an official
notice source, and define scheduled outage records with affected areas, start/end
times, publication time, source URL and expiry. Add those only when a real source
and a maintenance owner are available. Review the contact directory periodically.

Verification: `npm test`, all-platform Expo export, and mobile-width browser checks
for navigation, alert filters/detail cards, empty results, call confirmation/cancel
and About links. Never place real emergency calls during testing.
