#!/usr/bin/env node
// Builds data/talks.json: a fictional KubeCon day (Wednesday, Nov 11, 2026)
// for the demo. The talks that drive the demo are written by hand below;
// the rest are drafted by an OpenAI model and reviewed. Every person and
// company is fictional. Embeddings are precomputed so CI and the cluster can
// index the data without calling OpenAI.
//
//   OPENAI_API_KEY=... node scripts/generate-talks.mjs
import fs from 'node:fs/promises';

const MODEL = process.env.LLM_MODEL ?? 'gpt-6-luna';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 512);
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error('OPENAI_API_KEY is required');

const rooms = JSON.parse(await fs.readFile(new URL('../data/rooms.json', import.meta.url), 'utf8'));
const sessionRooms = rooms.filter((r) => r.kind === 'session');

// Slot times in UTC. Salt Lake City is UTC-7 in November (MST).
const SLOTS = {
  S1: ['2026-11-11T18:00:00Z', '2026-11-11T18:30:00Z'], // 11:00 MT
  S2: ['2026-11-11T18:45:00Z', '2026-11-11T19:15:00Z'], // 11:45
  S3: ['2026-11-11T19:30:00Z', '2026-11-11T20:00:00Z'], // 12:30
  S4: ['2026-11-11T21:00:00Z', '2026-11-11T21:30:00Z'], // 2:00 PM, after lunch
  S5: ['2026-11-11T21:45:00Z', '2026-11-11T22:15:00Z'], // 2:45
  S6: ['2026-11-11T22:30:00Z', '2026-11-11T23:00:00Z'], // 3:30
  S7: ['2026-11-11T23:15:00Z', '2026-11-11T23:45:00Z'], // 4:15
  S8: ['2026-11-12T00:00:00Z', '2026-11-12T00:30:00Z'], // 5:00
};

const sp = (name, company) => ({ name, company });

// Hand-written talks: the 2:00 PM slot (the demo's full room and its Plan B
// candidates), the morning overflows, and talks the search demo relies on.
const HAND = [
  { room: 'GB', slot: 'K1', start: '2026-11-11T16:00:00Z', end: '2026-11-11T16:20:00Z', kind: 'keynote', interest: 2600,
    title: 'Welcome to Salt Lake City: Cloud Native in 2026', level: 'Beginner', tags: ['keynote', 'community', 'state-of-cloud-native'],
    abstract: 'The opening keynote: where the community is, what changed this year, and what the next ten thousand contributors will need from us.',
    speakers: [sp('Dana Whitfield', 'Open Cloud Collective')] },
  { room: 'GB', slot: 'K2', start: '2026-11-11T16:25:00Z', end: '2026-11-11T16:45:00Z', kind: 'keynote', interest: 2500,
    title: "Ten Years of Kubernetes in Production: What We'd Do Again", level: 'Beginner', tags: ['keynote', 'production', 'lessons-learned'],
    abstract: 'A decade of running clusters for a bank, a game studio and a hospital network, distilled into the decisions that aged well and the ones we quietly undid.',
    speakers: [sp('Marcus Oyelaran', 'Bramblewood Systems')] },
  { room: 'GB', slot: 'K3', start: '2026-11-11T16:50:00Z', end: '2026-11-11T17:10:00Z', kind: 'keynote', interest: 2400,
    title: 'Conferences for Everyone', level: 'Beginner', tags: ['keynote', 'inclusion', 'accessibility', 'community'],
    abstract: 'Captions, quiet rooms, step-free routes and first-timer guides: what it takes to make a room of ten thousand people feel welcoming, and how the community can help.',
    speakers: [sp('Ines Kowalczyk', 'Hot Spring Labs')] },

  // 2:00 PM: the full room and the alternatives Capy weighs.
  { room: '155E', slot: 'S4', interest: 900, captioned: true,
    title: 'Hardening the Kernel Boundary: eBPF Runtime Security in Production', level: 'Advanced',
    tags: ['ebpf', 'runtime-security', 'lsm', 'containers', 'threat-detection'],
    abstract: 'Three years ago we moved runtime enforcement out of sidecars and into eBPF programs attached to LSM hooks. This talk walks through what that looks like across 4,000 nodes: blocking container escapes before they land, keeping policy in Git, surviving kernel upgrades, and the two outages we caused along the way.',
    speakers: [sp('Priya Raman', 'Lantern Labs'), sp('Tomas Ferreira', 'Lantern Labs')] },
  { room: '251', slot: 'S4', interest: 80,
    title: 'Zero-Trust Datapaths: Identity-Aware Policy in the Kernel', level: 'Intermediate',
    tags: ['ebpf', 'zero-trust', 'network-policy', 'identity', 'datapath'],
    abstract: "What if every packet carried a workload's identity and the kernel enforced who may talk to whom? We build identity-aware network policy on a programmable datapath, compare it with sidecar mTLS, and show a misbehaving pod cut off in microseconds instead of minutes.",
    speakers: [sp('Aiko Tanabe', 'Northwind Mesh')] },
  { room: '355A', slot: 'S4', interest: 300, captioned: true,
    title: 'Catching Container Escapes Before Your Pager Does', level: 'Intermediate',
    tags: ['runtime-detection', 'incident-response', 'syscalls', 'on-call', 'containers'],
    abstract: 'Most breakout attempts look like a burst of odd syscalls minutes before anything pages. Our SRE team turned kernel-level signals into high-confidence alerts, cut false positives by 90%, and wrote runbooks a sleepy on-call engineer can follow at 3 a.m.',
    speakers: [sp('Gabriel Osei', 'Juniper Freight')] },
  { room: '254', slot: 'S4', interest: 60,
    title: 'Sandboxes All the Way Down: Isolating Untrusted Workloads with WASM and microVMs', level: 'Advanced',
    tags: ['wasm', 'sandboxing', 'microvm', 'isolation', 'multi-tenancy'],
    abstract: "Running other people's code is a promise about blast radius. We compare WebAssembly components, gVisor and microVMs for multi-tenant platforms: startup time, density, syscall surface, and what actually stopped a real escape attempt in our bug bounty.",
    speakers: [sp('Lena Brandt', 'Copperline Compute')] },
  { room: '155F', slot: 'S4', interest: 150,
    title: 'Every Syscall Counts: Always-On Profiling with eBPF', level: 'Intermediate',
    tags: ['ebpf', 'profiling', 'opentelemetry', 'performance', 'continuous-profiling'],
    abstract: 'Continuous profiling used to mean choosing between overhead and blind spots. We feed an eBPF-based profiler into OpenTelemetry profiles next to our traces, hold it to a 1% overhead budget, and show three regressions it caught before customers did.',
    speakers: [sp('Ravi Menon', 'Tidewater Analytics')] },
  { room: '355D', slot: 'S4', interest: 60,
    title: 'Workload Identity Deep Dive: Tokens, Certificates and RBAC Footguns', level: 'Advanced',
    tags: ['workload-identity', 'rbac', 'service-accounts', 'authentication', 'kubernetes'],
    abstract: 'Projected service account tokens, structured authentication configuration and pod certificates: a maintainer-led tour of how workloads prove who they are in Kubernetes, and the RBAC mistakes we still see in every audit.',
    speakers: [sp('Sofia Lindqvist', 'Granite Peak Software')] },
  { room: '150A', slot: 'S4', interest: 150,
    title: 'Inner Loop Bliss: Hot-Reloading Into a Remote Cluster', level: 'Beginner',
    tags: ['developer-experience', 'inner-loop', 'dev-environments', 'productivity'],
    abstract: 'Your laptop is not production, but your feedback loop can feel like it. We show how our developers edit code locally and see it running in a real remote cluster in under two seconds, with debuggers, logs and traces attached.',
    speakers: [sp('Jonah Reyes', 'Paperkite')] },
  { room: '151', slot: 'S4', interest: 90, captioned: true,
    title: 'Your First KubeCon Talk: Notes From the Program Committee', level: 'Beginner',
    tags: ['cfp', 'speaking', 'community', 'mentorship'],
    abstract: 'Program committee members share what makes a proposal stand out, why most rejections have nothing to do with quality, and how first-time speakers can find a mentor for their next submission.',
    speakers: [sp('Amara Nwosu', 'Open Cloud Collective'), sp('Kenji Watanabe', 'Bluebird Health')] },
  { room: '250A', slot: 'S4', interest: 380,
    title: 'Golden Paths People Actually Walk', level: 'Intermediate',
    tags: ['platform-engineering', 'golden-paths', 'developer-portals', 'templates'],
    abstract: 'We built twelve golden paths and teams used two. This is the story of measuring what developers really do, deleting most of our templates, and the one paved road that now carries 80% of new services.',
    speakers: [sp('Hannah Cho', 'Maplestone Retail')] },
  { room: '250B', slot: 'S4', interest: 310,
    title: 'GPUs Are a Shared Resource Now: Dynamic Resource Allocation in Practice', level: 'Advanced',
    tags: ['gpu', 'dynamic-resource-allocation', 'scheduling', 'ai-infrastructure'],
    abstract: 'Dynamic Resource Allocation turns GPUs from whole devices into claims you can share, slice and schedule fairly. We cover drivers, device classes and the quota model that ended GPU hoarding across our research teams.',
    speakers: [sp('Omar Haddad', 'Quantum Pines')] },
  { room: '355B', slot: 'S4', interest: 260,
    title: 'Postgres on Kubernetes: The Failover Drill We Run Every Friday', level: 'Intermediate',
    tags: ['postgres', 'operators', 'disaster-recovery', 'stateful-workloads'],
    abstract: 'Every Friday at 2 p.m. we kill our primary database on purpose. Here is the operator setup, the backups we actually restore from, and the drill checklist that turned database failover from an incident into a non-event.',
    speakers: [sp('Elena Petrova', 'Cobalt Ledger')] },
  { room: '355C', slot: 'S4', interest: 120,
    title: 'Carbon-Aware Autoscaling: Moving Batch Work to Greener Hours', level: 'Intermediate',
    tags: ['sustainability', 'autoscaling', 'batch', 'event-driven'],
    abstract: 'Not every job has to run now. We shift batch workloads toward hours when the grid is cleaner using event-driven autoscaling and carbon intensity signals, and share the dashboards that convinced finance and the sustainability team at once.',
    speakers: [sp('Noor Aziz', 'Evergreen Data')] },

  // Other talks the demo leans on.
  { room: '251', slot: 'S1', interest: 190,
    title: 'Watching the Kernel Watch You: Threat Hunting Without Sidecars', level: 'Intermediate',
    tags: ['kernel-tracing', 'threat-hunting', 'runtime', 'sidecarless'],
    abstract: 'Attackers love the blind spot between the container and the host. We trace process, file and network activity straight from the kernel to hunt intrusions in real time, with no sidecars and no agent per pod, and show the queries that found a cryptominer hiding in a CI runner.',
    speakers: [sp('Mateo Silva', 'Redfern Games')] },
  { room: '155F', slot: 'S2', interest: 230,
    title: 'Programmable Kernels for Observability Engineers', level: 'Beginner',
    tags: ['ebpf', 'tracing', 'observability', 'kernel'],
    abstract: 'You do not need to be a kernel hacker to get kernel-level visibility. A gentle, demo-heavy introduction to attaching small safe programs to the kernel for latency, DNS and TCP insight, and exporting it all as OpenTelemetry.',
    speakers: [sp('Chloe Martin', 'Tidewater Analytics')] },
  { room: '250B', slot: 'S2', interest: 520,
    title: 'Serving LLMs on Kubernetes Without Melting Your GPUs', level: 'Intermediate',
    tags: ['llm-serving', 'gpu', 'autoscaling', 'inference', 'ai-infrastructure'],
    abstract: 'Batching, KV-cache-aware routing and scale-to-zero for model servers: how we serve a dozen open models on a shared GPU pool, keep p99 latency under a second, and stopped paging the ML team every time traffic doubled.',
    speakers: [sp('Yusuf Demir', 'Lumen Assist')] },
  { room: '250A', slot: 'S6', interest: 700,
    title: 'Platform Teams Are Product Teams: Lessons From 40 Internal Customers', level: 'Beginner',
    tags: ['platform-engineering', 'product-management', 'developer-experience', 'team-topologies'],
    abstract: 'Our platform team stopped taking tickets and started running user research. We share the interviews, the roadmap we threw away, and how treating forty internal teams as customers doubled adoption in a year.',
    speakers: [sp('Grace Mbeki', 'Harborlight Insurance')] },
  { room: '155E', slot: 'S7', interest: 360,
    title: 'Your Supply Chain Ends at Runtime', level: 'Intermediate',
    tags: ['supply-chain', 'signing', 'admission-control', 'runtime-security'],
    abstract: 'Signed images and SBOMs tell you what you meant to ship. Admission policy and runtime verification tell you what is actually running. We connect the two so a tampered image never starts and a drifted container gets caught within seconds.',
    speakers: [sp('Isabel Duarte', 'Quillstack')] },
];

const handKey = (t) => `${t.room}:${t.slot}`;
const taken = new Set(HAND.map(handKey));

async function openai(path, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if (attempt === 3 || res.status < 500) throw new Error(`${path} ${res.status}: ${text.slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function draftRoom(room) {
  const slots = Object.keys(SLOTS).filter((s) => !taken.has(`${room.id}:${s}`));
  if (slots.length === 0) return [];
  const existing = HAND.filter((t) => t.room === room.id).map((t) => `- ${t.title}`).join('\n') || '- (none)';
  const prompt = `Draft ${slots.length} conference talks for the "${room.track}" track of a KubeCon-style cloud native conference in 2026.
Slots to fill, in order: ${slots.join(', ')}.
Already scheduled in this track (do not repeat their topics):
${existing}

Rules:
- Realistic, specific, practitioner talks. Titles under 80 characters, varied in style.
- Abstract: 2 or 3 sentences, 40 to 70 words, concrete (numbers, war stories, what attendees learn).
- level: Beginner, Intermediate or Advanced.
- tags: 3 to 5 lowercase, hyphenated topic tags.
- speakers: 1 or 2 FICTIONAL people with FICTIONAL company names. Never real people or real companies. Real open source project names (Kubernetes, Prometheus, OpenTelemetry, Envoy, Argo, Cilium and so on) are fine.
Return JSON: {"talks":[{"slot":"S1","title":"...","abstract":"...","level":"...","tags":["..."],"speakers":[{"name":"...","company":"..."}]}]}`;
  const out = await openai('chat/completions', {
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You write conference programs. You only output valid JSON.' },
      { role: 'user', content: prompt },
    ],
  });
  const parsed = JSON.parse(out.choices[0].message.content);
  return parsed.talks
    .filter((t) => slots.includes(t.slot))
    .map((t) => ({ ...t, room: room.id }));
}

const drafted = (await Promise.all(sessionRooms.map(draftRoom))).flat();
console.log(`hand-written: ${HAND.length}, drafted: ${drafted.length}`);

const rand = (() => {
  let s = 20261111; // deterministic interest numbers
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
})();

const roomById = new Map(rooms.map((r) => [r.id, r]));
const all = [...HAND, ...drafted].map((t) => {
  const room = roomById.get(t.room);
  const [start, end] = t.start ? [t.start, t.end] : SLOTS[t.slot];
  const interest = t.interest ?? Math.round(room.capacity * (0.35 + rand() * 0.5));
  return {
    id: `t-${t.room.toLowerCase()}-${t.slot.toLowerCase()}`,
    kind: t.kind ?? 'session',
    title: t.title.trim(),
    abstract: t.abstract.trim(),
    track: room.track,
    level: t.level,
    tags: t.tags.map((x) => x.toLowerCase()),
    speakers: t.speakers,
    roomId: t.room,
    slot: t.slot,
    start,
    end,
    interest,
    captioned: t.captioned ?? rand() < 0.3,
  };
});
all.sort((a, b) => a.start.localeCompare(b.start) || a.roomId.localeCompare(b.roomId));

const inputs = all.map((t) => `${t.title}\n${t.abstract}\nTopics: ${t.tags.join(', ')}. Track: ${t.track}.`);
const emb = await openai('embeddings', { model: EMBEDDING_MODEL, input: inputs, dimensions: DIMENSIONS });
emb.data.forEach((d, i) => {
  all[i].embedding = d.embedding.map((v) => Math.round(v * 1e6) / 1e6);
});

// talks.json stays readable for review; vectors live in their own file.
const vectors = Object.fromEntries(all.map((t) => [t.id, t.embedding]));
for (const t of all) delete t.embedding;
await fs.writeFile(new URL('../data/talks.json', import.meta.url), JSON.stringify({
  note: 'Synthetic schedule for the CapyKube demo. Every person and company is fictional.',
  embeddingModel: EMBEDDING_MODEL,
  dimensions: DIMENSIONS,
  talks: all,
}, null, 2) + '\n');
const lines = Object.entries(vectors).map(([id, v]) => `  ${JSON.stringify(id)}: ${JSON.stringify(v)}`);
await fs.writeFile(new URL('../data/talk-embeddings.json', import.meta.url),
  `{\n "model": ${JSON.stringify(EMBEDDING_MODEL)},\n "dimensions": ${DIMENSIONS},\n "vectors": {\n${lines.join(',\n')}\n }\n}\n`);
console.log(`wrote ${all.length} talks`);
