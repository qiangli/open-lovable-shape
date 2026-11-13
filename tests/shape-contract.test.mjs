import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('local bashy OCI is the only sandbox provider', async () => {
  const factory = await read('lib/sandbox/factory.ts');
  const provider = await read('lib/sandbox/providers/bashy-oci-provider.ts');
  assert.match(factory, /SANDBOX_PROVIDER \|\| 'bashy-oci'/);
  assert.match(provider, /\['oci', \.\.\.args\]/);
  assert.match(provider, /'127\.0\.0\.1::5173'/);
  assert.match(provider, /mkdir -p \$\{WORKDIR\}/);
  assert.doesNotMatch(factory, /E2BProvider|VercelProvider/);
});

test('the owner gateway is OpenAI-compatible and its key is optional', async () => {
  const provider = await read('lib/ai/owner-provider.ts');
  assert.match(provider, /OPENAI_COMPATIBLE_BASE_URL/);
  assert.match(provider, /owner-gateway-no-key/);
  assert.doesNotMatch(provider, /api\.openai\.com|ai-gateway\.vercel/);
});

test('Firecrawl is opt-in', async () => {
  const guard = await read('lib/firecrawl-enabled.ts');
  assert.match(guard, /ENABLE_FIRECRAWL !== 'true'/);
  for (const route of ['extract-brand-styles', 'scrape-screenshot', 'scrape-url-enhanced', 'scrape-website', 'search']) {
    const source = await read(`app/api/${route}/route.ts`);
    assert.match(source, /requireFirecrawlEnabled\(\)/, route);
  }
});

test('fonts are bundled locally', async () => {
  const layout = await read('app/layout.tsx');
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /next\/font\/local/);
});

test('owner OTLP tracing is opt-in and has no default collector', async () => {
  const hook = await read('instrumentation.ts');
  const telemetry = await read('lib/telemetry/owner-otel.ts');
  assert.match(hook, /OTEL_EXPORTER_OTLP_ENDPOINT/);
  assert.match(hook, /OTEL_EXPORTER_OTLP_TRACES_ENDPOINT/);
  assert.match(telemetry, /getNodeAutoInstrumentations/);
  assert.match(telemetry, /OTLPTraceExporter/);
  assert.doesNotMatch(telemetry, /https?:\/\//);
});
