# Changelog

## [0.2.0] - 2026-11-03

### Added
- `listModels({ provider?, since? })` and `getModel(id)` read the AICM pricing
  catalog across all providers. `since` keeps models first listed at or after a
  time, so a caller can poll for new ones using the newest `first_seen_at`.
- `npm test`: client tests on Node's built-in runner, plus the smoke test.

### Fixed
- Webhook methods called `/webhooks/`, which no longer exists. They now use the
  API key's team, `/teams/{slug}/webhooks/` (the slug is looked up once), and
  update with PATCH. `WebhookEndpointOut` has `purpose` and no longer claims
  `secret` or `team_uuid`.

### Removed
- `listVendors()`, `listVendorServices()`, `listServiceCosts()` and the
  `VendorOut` / `ServiceOut` types. Their routes were removed from the server
  and every call returned 404. `CostUnitOut` now describes a catalog rate.

## 0.1.0 (2025-02-24)

### Added
- `CostManagerClient` with full API coverage (~30 endpoints)
- `Tracker` class with `track()`, `trackBatch()`, `trackLlmUsage()`, `trackLlmStreamUsage()`
- `ImmediateDelivery` strategy with HTTP POST + retry
- LLM usage extraction for 6 vendors (OpenAI, Anthropic, Gemini, Bedrock, Fireworks, xAI)
- Drop-in `configureTracker()` / `track()` / `trackLlmUsage()` convenience functions
- `AsyncGenerator`-based auto-pagination for `iter*` methods
- All types/models ported from Python SDK
- Full error class hierarchy
- CI/CD publishing via GitHub Actions
