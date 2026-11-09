# CapyKube

**A kube-scheduler for humans.** When the talk you wanted is full, Capy finds
you the closest talk by topic that has seats, starts soon and is a short walk
away, and holds you a seat on the way there.

Rooms are nodes with capacity. Attendees are pods. When a room fills up,
CapyKube reschedules people the way Kubernetes reschedules pods: it filters
(starts within minutes, has seats, step-free if you need it), then scores
(closest in topic, shortest walk, least crowded), then binds (holds a seat so
it never sends 200 people to a room with 30 seats).

Built at the [Cloud Native Hackathon](https://www.wemakedevs.org/hackathons/cnh),
Salt Lake City, November 9, 2026, by team **capykube2**.

> Work in progress: this README grows with each pull request.

## How it's built

| Piece | Role |
| --- | --- |
| **Elasticsearch** | The data layer: talks, rooms, live room status and every Plan B request. One query does the scheduler's Filter and Score phases. |
| **Dash0** | OpenTelemetry traces, metrics and logs from the API, real-user monitoring from the browser, and the SLO that sets Capy's mood. |
| **Radar** | Runs and operates the app on the team's Kubernetes cluster: GitOps deploys, Checks, and AI investigations. |
| **Gitar** | Reviews every pull request against [our conventions](docs/conventions.md) and repository rules, and fixes CI failures. |

## Run it locally

Requires Node 22 and pnpm.

```bash
cd app
pnpm install
pnpm build
pnpm start
```

Then open http://localhost:8080. Set `DASH0_AUTH_TOKEN` to send telemetry to
Dash0.

## AI disclosure

This project was built with an AI coding assistant (Claude Code), as the
hackathon rules allow and require us to disclose. The team chose the idea,
made the product and architecture decisions, reviewed the pull requests, and
operated the app. Gitar, an AI code reviewer, reviewed every pull request.
