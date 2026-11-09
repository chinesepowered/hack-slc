# Radar: running CapyKube on the team cluster

CapyKube runs on the team's virtual cluster, `capykube2`, in namespace
`team-capykube2`. Our coding agent did every cluster operation through
Radar Cloud's MCP server; nobody ran `kubectl`.

## What runs

| Workload | What it is | Requests | Limits |
| --- | --- | --- | --- |
| Deployment `app` | The API, the scheduler and the crowd simulator | 150m CPU, 256Mi | 1 CPU, 512Mi |
| StatefulSet `es` | Elasticsearch 9.2, single node, one 5Gi volume | 500m CPU, 1536Mi | 2 CPU, 2Gi |
| **Total** | | **650m CPU, 1792Mi** of 2 CPU, 4GiB | **3 CPU, 2.5GiB** of 4 CPU, 8GiB |

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

## Radar Cloud pages

- Timeline: https://app.radarhq.io/c/b6tBbVG5WFw/timeline
- The Argo CD Application: https://app.radarhq.io/c/b6tBbVG5WFw/resources/applications?resource=team-capykube2/app&apiGroup=argoproj.io
- Checks for our namespace: https://app.radarhq.io/checks?scope=b6tBbVG5WFw&namespace=team-capykube2
- Deployment `app`, where the sparkle button starts an AI investigation:
  https://app.radarhq.io/c/b6tBbVG5WFw/resources/deployments?resource=team-capykube2/app
