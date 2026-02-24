/** Error class hierarchy for the AI Cost Manager SDK. */

import type { ErrorResponse } from "./types.js";

export class AICMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AICMError";
  }
}

export class MissingConfiguration extends AICMError {
  constructor(message: string) {
    super(message);
    this.name = "MissingConfiguration";
  }
}

export class APIRequestError extends AICMError {
  statusCode: number;
  errorResponse: ErrorResponse | null = null;
  error: string | null = null;
  detail: string | null = null;
  details: string | null = null;

  constructor(statusCode: number, detail: unknown) {
    super(`API request failed with status ${statusCode}: ${JSON.stringify(detail)}`);
    this.name = "APIRequestError";
    this.statusCode = statusCode;
    if (detail && typeof detail === "object" && "detail" in detail) {
      const d = detail as Record<string, unknown>;
      this.errorResponse = { detail: String(d.detail), code: d.code as string | undefined };
      this.error = String(d.detail);
      this.detail = String(d.detail);
      this.details = (d.code as string) ?? null;
    } else if (detail && typeof detail === "object") {
      const d = detail as Record<string, unknown>;
      this.error = d.detail != null ? String(d.detail) : null;
      this.detail = this.error;
    }
  }
}

export class UsageLimitExceeded extends AICMError {
  triggeredLimits: unknown[];

  constructor(triggeredLimits: unknown[]) {
    const info = Array.isArray(triggeredLimits)
      ? triggeredLimits
          .map((tl) => {
            const t = tl as Record<string, unknown>;
            return `limit ${t.limit_id} (${t.threshold_type})`;
          })
          .join(", ")
      : "";
    super(`Usage limit exceeded: ${info}`);
    this.name = "UsageLimitExceeded";
    this.triggeredLimits = triggeredLimits;
  }
}

export class NoCostsTrackedException extends AICMError {
  constructor() {
    super("No cost events were recorded for the tracked payload");
    this.name = "NoCostsTrackedException";
  }
}

export class BatchSizeLimitExceeded extends AICMError {
  batchSize: number;
  maxBatchSize: number;

  constructor(batchSize: number, maxBatchSize: number) {
    super(
      `Batch size of ${batchSize} exceeds maximum allowed limit of ${maxBatchSize}`
    );
    this.name = "BatchSizeLimitExceeded";
    this.batchSize = batchSize;
    this.maxBatchSize = maxBatchSize;
  }
}
