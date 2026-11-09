# CapyKube conventions

These are the rules this codebase lives by. Gitar reviews every pull request
against them, and coding agents read them through `AGENTS.md`.

## Time

- Store and compare times as UTC: ISO-8601 strings or epoch milliseconds.
- Show a time to a person only through `formatVenueTime`, `formatVenueRange`
  or `formatVenueDay` in `app/src/shared/time.ts`. They render in the venue's
  time zone, `America/Denver` (Mountain Time). Never call
  `toLocaleTimeString()` without a `timeZone`, or `getHours()`, for display.
- The demo clock (`SimClock`) is the only source of "now" for scheduling and
  simulation. Scheduler and simulator code never calls `Date.now()` directly.

## Elasticsearch

- Every search sets a `timeout` and a bounded `size` (50 or fewer). Every
  `terms` aggregation sets `size`.
- Never interpolate user input into a Painless script or a query string. Pass
  it as script `params` or as the value of a `match`/`multi_match`.
- Mappings live in `app/src/server/es-mappings.ts` and change only together
  with the bootstrap that creates the index.

## Scheduler (Plan B)

- Never offer more seats than a room has: offered = capacity − present − held.
- Every seat hold expires.
- The Filter and Score phases stay in one Elasticsearch query. Scoring weights
  live in `app/src/shared/scoring.ts`, nowhere else.

## Telemetry

- Every HTTP route and background job runs inside a span. Domain facts go in
  `capykube.*` attributes (room id, talk id, quiet mode). Never personal data.
- Metric names start with `capykube.` and use UCUM units (`ms`, `{person}`).
- Server code logs through the pino logger in `app/src/server/log.ts`, never
  `console.log`.

## Frontend

- WCAG 2.2 AA: every control has an accessible name, color is never the only
  signal (a FULL room says "Full" in text too), and focus is always visible.
- Respect `prefers-reduced-motion`: the capybaras stop waddling and the map
  switches to a calm, static mode.
- Components call the API only through `app/src/web/api.ts`.

## Kubernetes

- The team cluster's budget covers everything we run: 2 CPU / 4 GiB of
  requests and 4 CPU / 8 GiB of limits. Every container sets requests and
  limits, and the totals in `deploy/` stay inside the budget.
- No privileged pods, hostPath, hostNetwork or hostPID: the host refuses them.
- Secrets come from the `capykube-secrets` Secret, created out of band. Keys
  and tokens are never committed. The repo is public.
