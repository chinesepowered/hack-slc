Auto-apply may fix CI failures caused by the PR, type errors, failing unit
tests whose expectation is clearly right, missing span attributes, missing
accessible names, and findings about time formatting that route a display
through app/src/shared/time.ts.

Do not auto-apply changes to scoring weights in app/src/shared/scoring.ts,
resource requests or limits in deploy/, Elasticsearch mappings, or anything
under .gitar/. Leave those as suggestions for a person to decide.
