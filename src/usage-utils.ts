/** Utilities for extracting usage information from LLM API responses. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

// ── Vendor <-> API ID mappings ──

export const VENDOR_TO_API: Record<string, string> = {
  openai: "openai_chat",
  anthropic: "anthropic",
  "amazon-bedrock": "amazon-bedrock",
  "fireworks-ai": "fireworks-ai",
  xai: "openai_chat",
  google: "gemini",
};

export const API_TO_VENDOR: Record<string, string> = {
  openai_chat: "openai",
  openai_responses: "openai",
  "fireworks-ai": "fireworks-ai",
  anthropic: "anthropic",
  "amazon-bedrock": "amazon-bedrock",
  gemini: "google",
};

// ── Serialization helpers ──

function isSafePrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function toSerializableDict(data: unknown): Record<string, AnyObj> {
  if (data == null) return {};

  if (typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, AnyObj> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("_")) continue;
      if (typeof v === "function") continue;
      if (isSafePrimitive(v)) {
        result[k] = v;
      } else if (Array.isArray(v)) {
        result[k] = v.map((item) =>
          isSafePrimitive(item) ? item : toSerializableDict(item)
        );
      } else if (typeof v === "object" && v !== null) {
        result[k] = toSerializableDict(v);
      }
    }
    return result;
  }

  if (isSafePrimitive(data)) {
    return data as AnyObj;
  }

  return {};
}

// ── Field access helper ──

function getFieldValue(
  obj: AnyObj,
  camelCase: string,
  snakeCase: string
): AnyObj | null {
  if (obj == null) return null;
  if (typeof obj === "object") {
    const val = obj[camelCase] ?? obj[snakeCase] ?? null;
    if (val != null) return val;
  }
  return null;
}

// ── Gemini normalization ──

function normalizeGeminiUsage(usage: AnyObj): Record<string, AnyObj> {
  if (usage == null) return {};
  if (typeof usage !== "object") return {};

  const normalized: Record<string, AnyObj> = {};

  const fields: [string, string][] = [
    ["promptTokenCount", "prompt_token_count"],
    ["candidatesTokenCount", "candidates_token_count"],
    ["totalTokenCount", "total_token_count"],
    ["cachedContentTokenCount", "cached_content_token_count"],
    ["toolUsePromptTokenCount", "tool_use_prompt_token_count"],
    ["thoughtsTokenCount", "thoughts_token_count"],
  ];

  for (const [camel, snake] of fields) {
    const val = getFieldValue(usage, camel, snake);
    if (val != null) normalized[camel] = val;
  }

  // Handle detailed breakdowns
  const detailFields: [string, string][] = [
    ["promptTokensDetails", "prompt_tokens_details"],
    ["candidatesTokensDetails", "candidates_tokens_details"],
    ["cacheTokensDetails", "cache_tokens_details"],
  ];

  for (const [camel, snake] of detailFields) {
    const val = getFieldValue(usage, camel, snake);
    if (val != null) normalized[camel] = val;
  }

  return normalized;
}

// ── Per-vendor extractors ──

function extractOpenaiUsage(response: AnyObj): Record<string, AnyObj> {
  const usage = response?.usage ?? null;
  return toSerializableDict(usage);
}

function extractOpenaiStreamingUsage(chunk: AnyObj): Record<string, AnyObj> {
  let usage = chunk?.usage ?? null;
  // Responses API events often nest usage on the inner .response
  if (!usage && chunk?.response?.usage) {
    usage = chunk.response.usage;
  }
  // Dict fallbacks
  if (!usage && typeof chunk === "object" && chunk !== null) {
    usage =
      chunk.usage ??
      (chunk.response && typeof chunk.response === "object"
        ? chunk.response.usage
        : null) ??
      null;
  }
  return toSerializableDict(usage);
}

function extractAnthropicUsage(response: AnyObj): Record<string, AnyObj> {
  // Anthropic: response IS usage in some cases, otherwise .usage
  const usage = response?.usage != null ? response.usage : response;
  return toSerializableDict(usage);
}

function extractAnthropicStreamingUsage(
  chunk: AnyObj
): Record<string, AnyObj> {
  let usage: AnyObj = null;
  if (chunk?.usage != null) {
    usage = chunk.usage;
  } else if (chunk?.message?.usage != null) {
    usage = chunk.message.usage;
  }
  return toSerializableDict(usage);
}

function extractBedrockUsage(response: AnyObj): Record<string, AnyObj> {
  let usage: AnyObj = null;
  if (typeof response === "object" && response !== null) {
    if ("usage" in response) {
      usage = response.usage;
    } else if (
      "inputTokens" in response &&
      "outputTokens" in response &&
      "totalTokens" in response
    ) {
      usage = response;
    }
  }
  return toSerializableDict(usage);
}

function extractBedrockStreamingUsage(chunk: AnyObj): Record<string, AnyObj> {
  let usage: AnyObj = null;
  if (typeof chunk === "object" && chunk !== null) {
    if (chunk.metadata?.usage != null) {
      usage = chunk.metadata.usage;
    } else if (chunk.usage != null) {
      usage = chunk.usage;
    }
  }
  return toSerializableDict(usage);
}

function extractGeminiUsage(response: AnyObj): Record<string, AnyObj> {
  const usage =
    response?.usageMetadata ?? response?.usage_metadata ?? null;
  if (usage != null) return normalizeGeminiUsage(usage);
  return toSerializableDict(usage);
}

function extractGeminiStreamingUsage(chunk: AnyObj): Record<string, AnyObj> {
  let meta: AnyObj = null;

  // 1) direct on the event
  meta = chunk?.usageMetadata ?? chunk?.usage_metadata ?? null;

  // 2) nested under .model_response
  if (meta == null && chunk?.model_response) {
    meta =
      chunk.model_response.usageMetadata ??
      chunk.model_response.usage_metadata ??
      null;
  }

  // 3) dict-like fallback
  if (
    meta == null &&
    typeof chunk === "object" &&
    chunk !== null
  ) {
    const modelResp = chunk.model_response;
    meta =
      chunk.usageMetadata ??
      chunk.usage_metadata ??
      (modelResp && typeof modelResp === "object"
        ? modelResp.usageMetadata ?? modelResp.usage_metadata
        : null) ??
      null;
  }

  if (meta != null) return normalizeGeminiUsage(meta);
  return toSerializableDict(meta);
}

// ── Generic fallback extractors ──

function genericExtractUsage(response: AnyObj): Record<string, AnyObj> {
  // 1) .usage attribute
  if (response?.usage != null) return toSerializableDict(response.usage);

  // 2) .usage_metadata / .usageMetadata
  const meta = response?.usage_metadata ?? response?.usageMetadata ?? null;
  if (meta != null) return toSerializableDict(meta);

  // 3) dict["usage"]
  if (typeof response === "object" && response !== null && response.usage != null) {
    return toSerializableDict(response.usage);
  }

  // 4) response itself looks like usage data
  if (typeof response === "object" && response !== null) {
    const tokenFields = [
      "input_tokens",
      "output_tokens",
      "prompt_tokens",
      "completion_tokens",
      "inputTokens",
      "outputTokens",
      "total_tokens",
      "totalTokens",
    ];
    if (tokenFields.some((f) => f in response)) {
      return toSerializableDict(response);
    }
  }

  return {};
}

function genericExtractStreamingUsage(chunk: AnyObj): Record<string, AnyObj> {
  // 1) .usage
  if (chunk?.usage != null) return toSerializableDict(chunk.usage);

  // 2) .response.usage
  if (chunk?.response?.usage != null) {
    return toSerializableDict(chunk.response.usage);
  }

  // 3) .message.usage
  if (chunk?.message?.usage != null) {
    return toSerializableDict(chunk.message.usage);
  }

  // 4) .usage_metadata / .usageMetadata
  const meta = chunk?.usage_metadata ?? chunk?.usageMetadata ?? null;
  if (meta != null) return toSerializableDict(meta);

  // 5) dict["usage"]
  if (typeof chunk === "object" && chunk !== null && chunk.usage != null) {
    return toSerializableDict(chunk.usage);
  }

  // 6) dict["metadata"]["usage"]
  if (
    typeof chunk === "object" &&
    chunk !== null &&
    typeof chunk.metadata === "object" &&
    chunk.metadata !== null &&
    chunk.metadata.usage != null
  ) {
    return toSerializableDict(chunk.metadata.usage);
  }

  return {};
}

// ── Extractor registry ──

type ExtractorPair = [
  (response: AnyObj) => Record<string, AnyObj>,
  (chunk: AnyObj) => Record<string, AnyObj>,
];

const KNOWN_EXTRACTORS: Record<string, ExtractorPair> = {
  openai_chat: [extractOpenaiUsage, extractOpenaiStreamingUsage],
  openai_responses: [extractOpenaiUsage, extractOpenaiStreamingUsage],
  anthropic: [extractAnthropicUsage, extractAnthropicStreamingUsage],
  gemini: [extractGeminiUsage, extractGeminiStreamingUsage],
  "amazon-bedrock": [extractBedrockUsage, extractBedrockStreamingUsage],
  "fireworks-ai": [extractOpenaiUsage, extractOpenaiStreamingUsage],
};

// ── Public dispatch functions ──

export function getUsageFromResponse(
  response: AnyObj,
  apiId: string
): Record<string, AnyObj> {
  const [extractor] = KNOWN_EXTRACTORS[apiId] ?? [
    genericExtractUsage,
    genericExtractStreamingUsage,
  ];
  return extractor(response);
}

export function getStreamingUsageFromResponse(
  chunk: AnyObj,
  apiId: string
): Record<string, AnyObj> {
  const [, streamingExtractor] = KNOWN_EXTRACTORS[apiId] ?? [
    genericExtractUsage,
    genericExtractStreamingUsage,
  ];
  return streamingExtractor(chunk);
}
