---
title: "Team cluster budget"
description: "Keep everything in deploy/ inside the hackathon cluster's resource budget"
type: check
when: "The PR changes any file under deploy/"
actions: "Total the requests and limits of every container after the change; fail the check and comment with a budget table if a total exceeds the budget or a container has no requests or limits"
---

# Team cluster budget

The team's vcluster has one budget for everything we run, in every
namespace: **2 CPU and 4 GiB of requests, 4 CPU and 8 GiB of limits, 4 PVCs
and 20 GiB of storage**. A pod over budget stays `Pending` with
`exceeded quota: team-quota`.

For the manifests in `deploy/` after this PR (multiply by `replicas`, and
count init containers at their peak):

1. Post a table: workload, replicas, CPU request, memory request, CPU limit,
   memory limit, and a totals row against the budget.
2. Fail the check if any total exceeds the budget, or any container has no
   requests or no limits.
3. Fail the check if any pod is privileged, or uses hostPath, hostNetwork or
   hostPID: the host refuses those pods.
4. If a total is above 85% of its budget, pass but say so, since rollouts
   briefly run old and new pods side by side.
