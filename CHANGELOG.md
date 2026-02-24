# Changelog

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
