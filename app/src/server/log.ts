import pino from 'pino';

// The pino instrumentation adds trace_id/span_id to every record and ships
// the records to Dash0 as OpenTelemetry logs.
export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'capykube' },
});
