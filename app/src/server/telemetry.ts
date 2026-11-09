// Loaded with `node --require` before anything else, so the instrumentations
// can patch http, fastify, pino, undici and openai as they are required.
// Traces, metrics and logs all go to Dash0 over OTLP/HTTP.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const token = process.env.DASH0_AUTH_TOKEN;
const endpoint = process.env.DASH0_OTLP_ENDPOINT ?? 'https://ingress.europe-west4.gcp.dash0.com';

if (token && process.env.OTEL_SDK_DISABLED !== 'true') {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Dash0-Dataset': process.env.DASH0_DATASET ?? 'default',
  };

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'capykube',
    [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? 'dev',
    'service.namespace': 'capykube',
    'deployment.environment.name': process.env.DEPLOYMENT_ENVIRONMENT ?? 'local',
    'k8s.namespace.name': process.env.K8S_NAMESPACE ?? '',
    'k8s.pod.name': process.env.K8S_POD_NAME ?? '',
    'k8s.node.name': process.env.K8S_NODE_NAME ?? '',
    'k8s.cluster.name': process.env.TEAM_NAME ?? '',
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces`, headers }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics`, headers }),
        exportIntervalMillis: 10_000,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs`, headers }) }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => req.url === '/healthz' || req.url === '/readyz',
        },
      }),
      new FastifyOtelInstrumentation({ registerOnInitialization: true }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('beforeExit', shutdown);
}
