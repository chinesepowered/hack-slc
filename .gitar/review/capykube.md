# CapyKube review instructions

@docs/conventions.md

## What to look for, in priority order

1. **Seat accounting.** CapyKube tells people a room has seats. Flag any code
   path that can offer or hold more seats than `capacity − present − held`,
   holds that never expire, or a race between reading seats and holding them.
2. **Time zones.** Flag any time shown to a person that doesn't go through the
   helpers in `app/src/shared/time.ts`, any server-side wall-clock parsing, and
   any use of `Date.now()` in scheduler or simulator code instead of the demo
   clock.
3. **Elasticsearch safety.** Flag searches without `timeout` or with unbounded
   `size`, user input concatenated into Painless or query strings, and
   mapping changes that the bootstrap doesn't apply.
4. **Telemetry gaps.** A new route, job or external call without a span, a
   metric without the `capykube.` prefix or a unit, `console.log` in server
   code, or personal data in span attributes.
5. **Accessibility.** Controls without accessible names, information carried
   only by color, animations that ignore `prefers-reduced-motion`.
6. **Kubernetes budget.** Containers without requests and limits, totals in
   `deploy/` above 2 CPU / 4 GiB of requests or 4 CPU / 8 GiB of limits, and
   anything privileged or using host namespaces or hostPath.
7. **Secrets.** Any key, token or password committed anywhere.

Skip style nits the formatter would fix. Prefer one precise finding with a
suggested fix over several vague ones.
