import { createOpenAI } from '@ai-sdk/openai';

function configuredBaseURL(): string {
  const value = process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL;
  if (!value) {
    throw new Error('Set OPENAI_COMPATIBLE_BASE_URL to the owner-configured OpenAI-compatible gateway');
  }
  return value.replace(/\/$/, '');
}

export function ownerModelName(requested?: string): string {
  return process.env.OPENAI_COMPATIBLE_MODEL || process.env.OPENAI_MODEL || requested?.replace(/^[^/]+\//, '') || 'gpt-4o-mini';
}

export function ownerModel(requested?: string) {
  const client = createOpenAI({
    baseURL: configuredBaseURL(),
    // Local gateways commonly do not authenticate; the SDK requires a value.
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY || 'owner-gateway-no-key',
  });
  return client(ownerModelName(requested));
}
