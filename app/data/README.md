# Demo data

A fictional KubeCon day (Wednesday, November 11, 2026) for the CapyKube demo.
**Every person and company here is made up.** Real open source project names
appear because they're what cloud native talks are about.

| File | What it holds |
| --- | --- |
| `rooms.json` | The venue: 12 session rooms, the Grand Ballroom, a quiet room and two amenities, with capacity, level, step-free access and map geometry. |
| `talks.json` | 99 talks: 3 keynotes and 8 slots across 12 rooms. Times are UTC. |
| `talk-embeddings.json` | 512-dimension `text-embedding-3-small` vectors for each talk, precomputed so the app and CI never need OpenAI to index. |

The talks that drive the demo (the full 2:00 PM security talk in Room 155 E,
the alternatives Capy weighs, and the morning overflows) are written by hand
in `scripts/generate-talks.mjs`. The rest were drafted by an OpenAI model and
reviewed. Regenerate with:

```bash
OPENAI_API_KEY=... node scripts/generate-talks.mjs
```
