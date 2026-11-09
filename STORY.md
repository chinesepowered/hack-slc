# CapyKube at the Cloud Native Hackathon

Team `capykube2`, cluster `capykube2`, namespace `team-capykube2`. Times are
Mountain Time on Monday, November 9, 2026.

## Before

12:44 PM, before our first deploy. Radar's Checks for `team-capykube2`:
https://app.radarhq.io/checks?scope=b6tBbVG5WFw&namespace=team-capykube2

3 findings, all medium, all on the platform's starter app:

- `automountServiceAccountToken`: Deployment `app`
- `missingPDB`: Deployment `app`
- `missingTopologySpread`: Deployment `app`

## The story

- **What we built.** CapyKube, a kube-scheduler for humans: when a
  conference room is full, it finds each person the closest talk by topic
  that has seats and holds them one. It helps the attendee at a full door,
  the door staff, and the organizer who never knew how many people were
  turned away. Live at https://capykube2.cnh.radarhq.io.
- **How we shipped.** 19 pull requests, each reviewed by Gitar, and 14
  deploys. Every merge that changed the app built an image and
  committed a `deploy:` commit; our coding agent synced Argo CD with Radar's
  `manage_gitops` and waited for each rollout with `wait_for`. Nobody ran
  kubectl.
- **What broke, and what Radar showed.** The first rollout (12:46 PM) never
  became ready. `wait_for` on Deployment `app` returned `blocked` with
  `ImagePullBackOff` and "failed to fetch anonymous token" from ghcr.io: the
  image had been published while the repo was private. Fixed in git
  ([#8](https://github.com/chinesepowered/hack-slc/pull/8)); rolled out 1/1
  at 1:32 PM.
- **The investigation.** A Radar AI investigation on Deployment `app` found
  it healthy and traced two readiness warnings to our own rollouts: one
  replica with `Recreate` meant about 20 seconds without the app on every
  deploy. Asked about the morning's 46 minutes, it rebuilt the timeline from
  the revision history, but the events had expired and it guessed an app
  start-up bug; it also pointed out that nothing stood between a bad image
  and the cluster. We acted on both
  ([#13](https://github.com/chinesepowered/hack-slc/pull/13)): a rolling
  update with one surge pod, and a build that refuses to deploy an image the
  cluster can't pull. On the next deploy the public URL, polled twice a
  second, failed one request out of 359, and on the deploy after that none
  of 260, against about 20 seconds without the app before.
- **Checks before and after.** 3 medium findings on the starter, 5 on our
  first deploy, 2 after
  [#9](https://github.com/chinesepowered/hack-slc/pull/9) (no service
  account tokens, read-only root filesystem on `app`). The two left have
  their reasons in the manifests: Elasticsearch writes under its install
  directory, and `app` keeps the simulator in one process.

The details are in [docs/radar.md](docs/radar.md).

## Radar Cloud pages to show

- The day's changes: https://app.radarhq.io/c/b6tBbVG5WFw/timeline
- The Argo CD Application: https://app.radarhq.io/c/b6tBbVG5WFw/resources/applications?resource=team-capykube2/app&apiGroup=argoproj.io
- Checks, whole cluster: https://app.radarhq.io/checks?scope=b6tBbVG5WFw
- Checks, our namespace: https://app.radarhq.io/checks?scope=b6tBbVG5WFw&namespace=team-capykube2
- The investigation: https://app.radarhq.io/c/b6tBbVG5WFw/investigations
