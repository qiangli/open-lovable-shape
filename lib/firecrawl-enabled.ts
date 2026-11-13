export function requireFirecrawlEnabled(): void {
  if (process.env.ENABLE_FIRECRAWL !== 'true') {
    throw new Error('Site cloning is disabled. Set ENABLE_FIRECRAWL=true to opt in.');
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is required after site cloning is enabled.');
  }
}
