import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export function startOwnerTelemetry() {
  if (sdk) return;

  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '');
  const url = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || (base ? `${base}/v1/traces` : undefined);
  if (!url) return;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'open-lovable-shape',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
    }),
    traceExporter: new OTLPTraceExporter({ url }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });
  sdk.start();
}
