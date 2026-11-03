# aicostmanager

TypeScript SDK for [AI Cost Manager](https://aicostmanager.com) — LLM cost tracking and usage management for teams.

**Zero runtime dependencies.** ESM-only. Node.js 18+.

## Installation

```bash
npm install aicostmanager
```

## Quick Start — Drop-in Tracking

The fastest way to start tracking LLM costs:

```typescript
import { configureTracker, track, trackLlmUsage } from "aicostmanager";

// Configure once at startup
configureTracker({ apiKey: "your-api-key" });

// Track raw usage
await track("openai::gpt-4o", { prompt_tokens: 100, completion_tokens: 50 });

// Or wrap LLM responses to auto-extract usage
import OpenAI from "openai";
const openai = new OpenAI();

const response = await trackLlmUsage(
  "openai::gpt-4o",
  await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello!" }],
  })
);
// response is returned unchanged, usage is tracked in the background
```

## Configuration

Set your API key via environment variable or in code:

```bash
export AICM_API_KEY=your-api-key
# Optional:
export AICM_API_BASE=https://aicostmanager.com
export AICM_API_URL=/api/v1
export AICM_RAISE_ON_ERROR=false
```

## Tracker Class

For more control, use the `Tracker` class directly:

```typescript
import { Tracker } from "aicostmanager";

const tracker = new Tracker({ apiKey: "your-api-key" });

// Set customer context for all subsequent calls
tracker.setCustomerKey("customer-123");
tracker.setContext({ environment: "production" });

// Track usage
await tracker.track("openai::gpt-4o", {
  prompt_tokens: 100,
  completion_tokens: 50,
});

// Track LLM response (auto-extracts usage)
const response = await tracker.trackLlmUsage("openai::gpt-4o", llmResponse);

// Track streaming responses
for await (const chunk of tracker.trackLlmStreamUsage("openai::gpt-4o", stream)) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}

// Batch tracking (up to 1000 records)
await tracker.trackBatch([
  { serviceKey: "openai::gpt-4o", usage: { prompt_tokens: 100, completion_tokens: 50 } },
  { serviceKey: "anthropic::claude-3-opus", usage: { input_tokens: 200, output_tokens: 100 } },
]);
```

## Full API Client

The `CostManagerClient` provides access to all API endpoints:

```typescript
import { CostManagerClient } from "aicostmanager";

const client = new CostManagerClient({ apiKey: "your-api-key" });

// Usage events
const events = await client.listUsageEvents({ service_id: "openai_chat" });

// Auto-paginate
for await (const event of client.iterUsageEvents()) {
  console.log(event.event_id);
}

// Customers
await client.createCustomer({ customer_key: "cust-123", name: "Acme Inc" });

// Usage limits
await client.createUsageLimit({
  threshold_type: ThresholdType.LIMIT,
  amount: "100.00",
  period: Period.MONTH,
});

// Model catalog: every model AICM prices, across all providers
const all = await client.listModels();
const anthropic = await client.listModels({ provider: "anthropic" });
// Poll for new models: pass the newest first_seen_at from the last call
const fresh = await client.listModels({ since: new Date("2026-11-01T00:00:00Z") });
const model = await client.getModel("anthropic::claude-fable-5-1");

// Webhooks
await client.createWebhookEndpoint({ url: "https://example.com/hook", secret: "s3cret" });

// Custom services
await client.createCustomService({
  custom_service_key: "my-service",
  configuration: {
    cost_units: [{ name: "api_call", cost: "0.01", unit: "call" }],
  },
});
```

## Supported LLM Vendors

Usage is automatically extracted from responses for:

| Vendor | Service Key Prefix | API ID |
|---|---|---|
| OpenAI | `openai::` | `openai_chat` |
| Anthropic | `anthropic::` | `anthropic` |
| Google Gemini | `google::` | `gemini` |
| Amazon Bedrock | `amazon-bedrock::` | `amazon-bedrock` |
| Fireworks AI | `fireworks-ai::` | `fireworks-ai` |
| xAI | `xai::` | `openai_chat` |

Generic fallback extraction works for any provider following standard patterns.

## API Method Reference

| Method | Description |
|---|---|
| **Usage Events** | |
| `listUsageEvents(filters?)` | List usage events (paginated) |
| `iterUsageEvents(filters?)` | Auto-paginate usage events |
| `getUsageEvent(id)` | Get single usage event |
| **Usage Rollups** | |
| `listUsageRollups(filters?)` | List usage rollups (paginated) |
| `iterUsageRollups(filters?)` | Auto-paginate usage rollups |
| **Customers** | |
| `listCustomers(filters?)` | List customers (paginated) |
| `iterCustomers(filters?)` | Auto-paginate customers |
| `createCustomer(data)` | Create customer |
| `getCustomer(id)` | Get customer |
| `updateCustomer(id, data)` | Update customer |
| `deleteCustomer(id)` | Delete customer |
| **Usage Limits** | |
| `listUsageLimits()` | List usage limits |
| `createUsageLimit(data)` | Create usage limit |
| `getUsageLimit(id)` | Get usage limit |
| `updateUsageLimit(id, data)` | Update usage limit |
| `deleteUsageLimit(id)` | Delete usage limit |
| `listUsageLimitProgress()` | List limit progress |
| **Model catalog** | |
| `listModels({ provider?, since? })` | Every catalog model; `since` keeps those first listed at or after it |
| `getModel(id)` | One catalog model by `provider::model` id |
| **Cost Events** | |
| `listCostEvents(filters?)` | List cost events |
| `listCostEventsByResponseId(id)` | Get cost events by response ID |
| **Webhooks** | |
| `createWebhookEndpoint(data)` | Create webhook |
| `listWebhookEndpoints(activeOnly?)` | List webhooks |
| `getWebhookEndpoint(uuid)` | Get webhook |
| `updateWebhookEndpoint(uuid, data)` | Update webhook |
| `deleteWebhookEndpoint(uuid)` | Delete webhook |
| **Custom Services** | |
| `listCustomServices(filters?)` | List custom services |
| `createCustomService(data)` | Create custom service |
| `getCustomService(uuid)` | Get custom service |
| `updateCustomService(uuid, data)` | Update custom service |
| `deleteCustomService(uuid)` | Delete custom service |
| **Other** | |
| `getTriggeredLimits()` | Get triggered limits |
| `getOpenapiSchema()` | Get OpenAPI schema |

## License

MIT — [Bright Wing Solutions LLC](https://brightwingsolutions.com)
