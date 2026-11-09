// Custom metrics. Names start with capykube. and carry UCUM units.
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('capykube');

export const searchRequests = meter.createCounter('capykube.search.requests', {
  description: 'Talk searches, by mode (hybrid or keyword)',
  unit: '{request}',
});

export const searchZeroResults = meter.createCounter('capykube.search.zero_results', {
  description: 'Talk searches that found nothing',
  unit: '{request}',
});

export const searchDuration = meter.createHistogram('capykube.search.duration', {
  description: 'Time to answer a talk search, including the query embedding',
  unit: 'ms',
});

export const planbRequests = meter.createCounter('capykube.planb.requests', {
  description: 'Plan B decisions, by source (sim, attendee or door)',
  unit: '{request}',
});

export const planbPeople = meter.createCounter('capykube.planb.people', {
  description: 'People turned away from a full room, by track: demand nobody could measure before',
  unit: '{person}',
});

export const planbUnplaced = meter.createCounter('capykube.planb.unplaced', {
  description: 'People Capy could not find a seat for',
  unit: '{person}',
});

export const planbDuration = meter.createHistogram('capykube.planb.duration', {
  description: 'Time for one Plan B decision: filter, score and bind',
  unit: 'ms',
});

export const llmNoteDuration = meter.createHistogram('capykube.capy_note.duration', {
  description: "Time to write Capy's note for a Plan B, including the model call",
  unit: 'ms',
});
