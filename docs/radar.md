# Radar: running CapyKube on the team cluster

CapyKube runs on the team's virtual cluster, `capykube2`, in namespace
`team-capykube2`. Our coding agent did every cluster operation through
Radar Cloud's MCP server; nobody ran `kubectl`.

## What runs

| Workload | What it is | Requests | Limits |
| --- | --- | --- | --- |
| Deployment `app` | The API, the scheduler and the crowd simulator | 150m CPU, 256Mi | 500m CPU, 512Mi |
| StatefulSet `es` | Elasticsearch 9.2, single node, one 5Gi volume | 500m CPU, 1536Mi | 2 CPU, 2Gi |
| **Total** | | **650m CPU, 1792Mi** of 2 CPU, 4GiB | **2.5 CPU, 2.5GiB** of 4 CPU, 8GiB |

During a rollout a second `app` pod runs for a few seconds, which takes the
totals to 800m CPU and 2GiB of requests, and 3 CPU and 3GiB of limits.

Service `app` (port 80) is what the platform routes
`https://capykube2.cnh.radarhq.io` to. Keys and passwords come from the
`capykube-secrets` Secret, created through Radar and never committed.

## How a change ships

1. A pull request is reviewed by Gitar and merged to `main`.
2. `build-and-deploy` builds the image and commits `deploy: <sha> [skip ci]`,
   which points `deploy/kustomization.yaml` at it.
3. The agent syncs the Argo CD Application with `manage_gitops`, waits for
   the rollout with `wait_for`, and checks that
   `https://capykube2.cnh.radarhq.io/api/version` reports that commit.

## Radar's MCP tools we used

| Tool | What for |
| --- | --- |
| `list_clusters` | Find `capykube2` among the organization's clusters |
| `list_resources`, `get_resource` | Read workloads, pods and the Argo CD Application |
| `apply_resource` | Create the `capykube-secrets` Secret and the Argo CD Application |
| `manage_gitops` | Sync the Application after every deploy commit |
| `wait_for` | Wait for each rollout instead of polling |
| `issues`, `diagnose` | See what's broken and why |
| `get_cluster_audit` | Radar's Checks, before and after |
| `top_resources` | Live CPU and memory, to size the app's limits |
| `start_investigation`, `get_investigation`, `follow_up_investigation` | The AI investigation below |

## What broke, and what Radar showed

The first rollout never became ready. `wait_for` on Deployment `app` came
back `blocked`, with the reason:

> Back-off pulling image "ghcr.io/chinesepowered/hack-slc:2ef1836":
> ErrImagePull: failed to pull and unpack image: failed to resolve image:
> failed to authorize: failed to fetch anonymous token

Elasticsearch was healthy, so the problem was the image, not the cluster.
The cause: a container package takes its repository's visibility when a
workflow first creates it, and ours was created while the repository was
still private. Making the repository public later did not change the
package.

The fix went through git like everything else
([#8](https://github.com/chinesepowered/hack-slc/pull/8)): publish the image
as `hack-slc/app`, a new package created after the repository went public.
The next sync rolled out `1/1`, and `/api/version` answered with the new
commit.

## Checks, before and after

`get_cluster_audit` for `team-capykube2`:

| When | Findings | What |
| --- | --- | --- |
| Before, with the platform's starter app | 3 medium | Service account token mounted, no PodDisruptionBudget, no topology spread |
| After our first deploy | 5 medium | Token mounted on `app` and `es`, writable root filesystem on both, one replica of `app` |
| After [#9](https://github.com/chinesepowered/hack-slc/pull/9) | 2 medium | See below |

Fixed in [#9](https://github.com/chinesepowered/hack-slc/pull/9): neither
workload mounts a service account token any more, and `app` runs with a
read-only root filesystem.

Left, each with its reason next to it in the manifest:

- **`es` keeps a writable root filesystem.** At start-up Elasticsearch
  writes its keystore and logs under its own install directory.
- **`app` has one replica.** The demo clock and the crowd simulator live in
  that process, so a second replica would run a second crowd. The room
  counts would move to Elasticsearch before this ran with two.

The one live issue Radar lists for the cluster, "CoreDNS service DNS
rewrite", is the virtual cluster's own DNS setup and shows on every team's
cluster.

## The AI investigation

We started a Radar AI investigation on Deployment `app` through the MCP
server (`start_investigation`), read it with `get_investigation`, and asked
one follow-up (`follow_up_investigation`). It ran for about a minute each
time.

**First answer: healthy, with one thing to see.**

> Deployment app is healthy now; a brief readiness blip during a routine
> image rollout self-resolved in seconds.

It lined up two readiness-probe warnings with our own image update: one
replica with the `Recreate` strategy stops the old pod before the new one is
ready, so the app was unavailable for about 20 seconds on every deploy.

**Follow-up: what happened this morning?** We asked about the 46 minutes
when the first rollout never became ready. From the revision history it
rebuilt the timeline: the first sync at 12:46 PM, the progress deadline
passing twice, a third image becoming ready in 14 seconds at 1:32 PM, and
nothing differing between the three but the image. It also said what it
could not see: the Warning events from that window had expired. Without
them it judged an app start-up bug "likely" (confidence 0.72). The cause
was the image pull, which we knew only because `wait_for` had shown us the
error while it was happening.

**What we learned**

- Investigate while it is happening. Kubernetes events expire, and an hour
  later the evidence that named the cause was gone.
- Its last point holds whatever the cause: "there's no CI/readiness gate in
  front of Argo's auto-sync today."

**What we did with it** ([#13](https://github.com/chinesepowered/hack-slc/pull/13))

- The Deployment rolls with one surge pod and `maxUnavailable: 0`, so the
  old pod serves until the new one is ready. Measured from outside on the
  next deploy, polling twice a second: one failed request out of 359, and
  never more than a second between good answers. On the deploy after that
  ([#16](https://github.com/chinesepowered/hack-slc/pull/16)), none of 260
  requests failed. Before, each deploy took the app away for about 20
  seconds.
- `build-and-deploy` checks that the image can be pulled without
  credentials before it writes the deploy commit, so an image the cluster
  can't pull never reaches Argo CD.

## Radar Cloud pages

- Timeline: https://app.radarhq.io/c/b6tBbVG5WFw/timeline
- The Argo CD Application: https://app.radarhq.io/c/b6tBbVG5WFw/resources/applications?resource=team-capykube2/app&apiGroup=argoproj.io
- Checks for our namespace: https://app.radarhq.io/checks?scope=b6tBbVG5WFw&namespace=team-capykube2
- Deployment `app`: https://app.radarhq.io/c/b6tBbVG5WFw/resources/deployments?resource=team-capykube2/app
- The AI investigation (visible to the person who started it):
  https://app.radarhq.io/c/b6tBbVG5WFw/investigations
