# Open Lovable Shape

An MIT-licensed fork of `firecrawl/open-lovable` adapted for an owner's local
Linux environment.

- Generated sites run in local Podman containers through `bashy oci`.
- LLM requests use the owner's OpenAI-compatible base URL. A key is optional.
- Firecrawl site cloning is disabled unless `ENABLE_FIRECRAWL=true` is set.
- No telemetry, analytics, support widget, update check, or vendor gateway is
  enabled by the application.

## Run

```sh
npm ci
cp .env.example .env.local
# Edit OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_MODEL.
npm run dev
```

Open `http://localhost:3000`. Creating a preview pulls the configured sandbox
image if it is not already present, installs the generated site's packages in
that container, and binds its preview port to loopback only.

To clone an existing site, explicitly set `ENABLE_FIRECRAWL=true` and provide
`FIRECRAWL_API_KEY`. No Firecrawl request is made otherwise.

## License

MIT. See [LICENSE](LICENSE).
