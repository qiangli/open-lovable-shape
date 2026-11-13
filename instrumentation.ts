export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return;

  const { startOwnerTelemetry } = await import('./lib/telemetry/owner-otel');
  startOwnerTelemetry();
}
