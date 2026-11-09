---
title: "API contract: frontend matches the server"
description: "When the server's API changes, check the web client and its callers still match it"
type: check
when: "The PR changes files under app/src/server/routes/ or app/src/shared/api-types.ts"
actions: "Compare the changed endpoints with app/src/web/api.ts and its callers; fail the check and comment with each mismatch"
---

# API contract

The web app talks to the server only through `app/src/web/api.ts`, using the
types in `app/src/shared/api-types.ts`.

When a PR changes a route's path, method, query parameters, request body or
response shape:

1. Find the matching function in `app/src/web/api.ts`.
2. Check that its URL, method, parameters and the type it returns match the
   server.
3. Check every component that calls it handles the new or changed fields
   (for example a new `null` case).

If anything no longer matches, fail the check and post one comment listing
each mismatch with the file and line on both sides, and the smallest change
that fixes it. If everything matches, pass and say which endpoints you
compared.
