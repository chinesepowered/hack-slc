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
