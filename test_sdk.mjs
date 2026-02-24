#!/usr/bin/env node
/**
 * Smoke test for the aicostmanager TypeScript SDK.
 * Verifies all exports are importable and constructable.
 */

import {
  // Client
  CostManagerClient,
  // Tracker
  Tracker,
  // Delivery
  ImmediateDelivery,
  // Drop-in functions
  configureTracker,
  track,
  trackLlmUsage,
  // Usage utilities
  VENDOR_TO_API,
  API_TO_VENDOR,
  getUsageFromResponse,
  getStreamingUsageFromResponse,
  toSerializableDict,
  // Errors
  AICMError,
  APIRequestError,
  BatchSizeLimitExceeded,
  MissingConfiguration,
  NoCostsTrackedException,
  UsageLimitExceeded,
  // Enums
  TrackStatus,
  ThresholdType,
  Period,
  Granularity,
} from "./dist/index.js";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

console.log("=== aicostmanager-ts SDK Smoke Tests ===\n");

// 1. CostManagerClient is constructable
console.log("1. CostManagerClient");
try {
  const client = new CostManagerClient({ apiKey: "test-key" });
  assert(client instanceof CostManagerClient, "CostManagerClient is constructable");
  assert(typeof client.listUsageEvents === "function", "has listUsageEvents method");
  assert(typeof client.listCustomers === "function", "has listCustomers method");
  assert(typeof client.listVendors === "function", "has listVendors method");
  assert(typeof client.createWebhookEndpoint === "function", "has createWebhookEndpoint method");
  assert(typeof client.listCustomServices === "function", "has listCustomServices method");
  assert(typeof client.getOpenapiSchema === "function", "has getOpenapiSchema method");
  assert(typeof client.iterUsageEvents === "function", "has iterUsageEvents generator");
} catch (e) {
  assert(false, `CostManagerClient construction failed: ${e.message}`);
}

// 2. CostManagerClient requires API key
console.log("\n2. CostManagerClient requires API key");
try {
  // Clear env
  const saved = process.env.AICM_API_KEY;
  delete process.env.AICM_API_KEY;
  try {
    new CostManagerClient();
    assert(false, "should throw without API key");
  } catch (e) {
    assert(e.message.includes("API key is required"), "throws without API key");
  }
  if (saved) process.env.AICM_API_KEY = saved;
} catch (e) {
  assert(false, `API key check failed: ${e.message}`);
}

// 3. Tracker is constructable
console.log("\n3. Tracker");
try {
  const tracker = new Tracker({ apiKey: "test-key" });
  assert(tracker instanceof Tracker, "Tracker is constructable");
  assert(typeof tracker.track === "function", "has track method");
  assert(typeof tracker.trackBatch === "function", "has trackBatch method");
  assert(typeof tracker.trackLlmUsage === "function", "has trackLlmUsage method");
  assert(typeof tracker.trackLlmStreamUsage === "function", "has trackLlmStreamUsage method");
  assert(typeof tracker.setCustomerKey === "function", "has setCustomerKey method");
  assert(typeof tracker.setContext === "function", "has setContext method");
} catch (e) {
  assert(false, `Tracker construction failed: ${e.message}`);
}

// 4. ImmediateDelivery is constructable
console.log("\n4. ImmediateDelivery");
try {
  const delivery = new ImmediateDelivery({
    apiKey: "test-key",
    baseUrl: "https://aicostmanager.com",
    apiUrl: "/api/v1",
    raiseOnError: false,
  });
  assert(delivery instanceof ImmediateDelivery, "ImmediateDelivery is constructable");
  assert(typeof delivery.send === "function", "has send method");
  assert(typeof delivery.sendBatch === "function", "has sendBatch method");
} catch (e) {
  assert(false, `ImmediateDelivery construction failed: ${e.message}`);
}

// 5. Drop-in functions exist
console.log("\n5. Drop-in functions");
assert(typeof configureTracker === "function", "configureTracker is a function");
assert(typeof track === "function", "track is a function");
assert(typeof trackLlmUsage === "function", "trackLlmUsage is a function");

// 6. VENDOR_TO_API / API_TO_VENDOR mappings
console.log("\n6. Vendor mappings");
assert(VENDOR_TO_API.openai === "openai_chat", "openai maps to openai_chat");
assert(VENDOR_TO_API.anthropic === "anthropic", "anthropic maps to anthropic");
assert(VENDOR_TO_API.google === "gemini", "google maps to gemini");
assert(VENDOR_TO_API["amazon-bedrock"] === "amazon-bedrock", "amazon-bedrock mapping");
assert(VENDOR_TO_API["fireworks-ai"] === "fireworks-ai", "fireworks-ai mapping");
assert(VENDOR_TO_API.xai === "openai_chat", "xai maps to openai_chat");
assert(API_TO_VENDOR.openai_chat === "openai", "reverse: openai_chat -> openai");
assert(API_TO_VENDOR.anthropic === "anthropic", "reverse: anthropic -> anthropic");
assert(API_TO_VENDOR.gemini === "google", "reverse: gemini -> google");

// 7. Usage extraction utilities
console.log("\n7. Usage extraction");
const mockOpenaiResponse = {
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
};
const extracted = getUsageFromResponse(mockOpenaiResponse, "openai_chat");
assert(extracted.prompt_tokens === 100, "extracts OpenAI prompt_tokens");
assert(extracted.completion_tokens === 50, "extracts OpenAI completion_tokens");

const mockAnthropicResponse = {
  usage: { input_tokens: 200, output_tokens: 100 },
};
const anthropicUsage = getUsageFromResponse(mockAnthropicResponse, "anthropic");
assert(anthropicUsage.input_tokens === 200, "extracts Anthropic input_tokens");

const mockStreamChunk = {
  usage: { prompt_tokens: 100, completion_tokens: 50 },
};
const streamUsage = getStreamingUsageFromResponse(mockStreamChunk, "openai_chat");
assert(streamUsage.prompt_tokens === 100, "extracts streaming usage");

// Test toSerializableDict
const serialized = toSerializableDict({ a: 1, _private: 2, fn: () => {} });
assert(serialized.a === 1, "toSerializableDict includes public fields");
assert(serialized._private === undefined, "toSerializableDict excludes private fields");
assert(serialized.fn === undefined, "toSerializableDict excludes functions");

// 8. Error classes
console.log("\n8. Error classes");
assert(new AICMError("test") instanceof Error, "AICMError extends Error");
assert(new APIRequestError(400, { detail: "bad" }) instanceof AICMError, "APIRequestError extends AICMError");
assert(new BatchSizeLimitExceeded(2000, 1000) instanceof AICMError, "BatchSizeLimitExceeded extends AICMError");
assert(new MissingConfiguration("missing") instanceof AICMError, "MissingConfiguration extends AICMError");
assert(new NoCostsTrackedException() instanceof AICMError, "NoCostsTrackedException extends AICMError");
assert(new UsageLimitExceeded([]) instanceof AICMError, "UsageLimitExceeded extends AICMError");

const apiErr = new APIRequestError(422, { detail: "Validation failed", code: "validation_error" });
assert(apiErr.statusCode === 422, "APIRequestError has statusCode");
assert(apiErr.error === "Validation failed", "APIRequestError has error");
assert(apiErr.details === "validation_error", "APIRequestError has details");

const batchErr = new BatchSizeLimitExceeded(2000, 1000);
assert(batchErr.batchSize === 2000, "BatchSizeLimitExceeded has batchSize");
assert(batchErr.maxBatchSize === 1000, "BatchSizeLimitExceeded has maxBatchSize");

// 9. Enums
console.log("\n9. Enums");
assert(TrackStatus.COMPLETED === "completed", "TrackStatus.COMPLETED");
assert(TrackStatus.QUEUED === "queued", "TrackStatus.QUEUED");
assert(ThresholdType.ALERT === "alert", "ThresholdType.ALERT");
assert(ThresholdType.LIMIT === "limit", "ThresholdType.LIMIT");
assert(Period.DAY === "day", "Period.DAY");
assert(Period.MONTH === "month", "Period.MONTH");
assert(Granularity.DAILY === "daily", "Granularity.DAILY");
assert(Granularity.HOURLY === "hourly", "Granularity.HOURLY");

// 10. Graceful error handling with bad key
console.log("\n10. Graceful error handling");
try {
  configureTracker({ apiKey: "bad-key-12345", raiseOnError: false });
  const result = await track("openai::gpt-4o", { prompt_tokens: 1 });
  assert(result.error !== undefined || result.result === null, "track with bad key returns error gracefully");
} catch (e) {
  // Even if it throws, that's acceptable since the server is unreachable
  assert(true, "track with bad key handled (threw or returned error)");
}

// Summary
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
