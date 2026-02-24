/** Tracker class for lightweight usage tracking. */

import { ImmediateDelivery } from "./delivery.js";
import { BatchSizeLimitExceeded } from "./errors.js";
import {
  API_TO_VENDOR,
  VENDOR_TO_API,
  getStreamingUsageFromResponse,
  getUsageFromResponse,
} from "./usage-utils.js";
import type {
  DeliveryResult,
  TrackBatchRecord,
  TrackOptions,
  TrackerConfig,
} from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

export class Tracker {
  private delivery: ImmediateDelivery;
  private customerKey: string | null = null;
  private context: Record<string, unknown> | null = null;

  constructor(config: TrackerConfig = {}) {
    const apiKey = config.apiKey ?? process.env.AICM_API_KEY ?? "";
    if (!apiKey) {
      throw new Error(
        "API key is required. Pass apiKey or set AICM_API_KEY environment variable."
      );
    }
    const baseUrl = (
      config.baseUrl ??
      process.env.AICM_API_BASE ??
      "https://aicostmanager.com"
    ).replace(/\/+$/, "");
    const apiUrl = (
      config.apiUrl ??
      process.env.AICM_API_URL ??
      "/api/v1"
    ).replace(/\/+$/, "");
    const raiseOnError =
      config.raiseOnError ??
      ["1", "true", "yes", "on"].includes(
        (process.env.AICM_RAISE_ON_ERROR ?? "false").toLowerCase()
      );

    this.delivery = new ImmediateDelivery({
      apiKey,
      baseUrl,
      apiUrl,
      raiseOnError,
    });
  }

  // ── Configuration ──

  setCustomerKey(key: string | null): void {
    this.customerKey = key;
  }

  setContext(context: Record<string, unknown> | null): void {
    this.context = context;
  }

  // ── Internal helpers ──

  private getVendorApiMapping(serviceKey: string): [string, string] {
    if (serviceKey.includes("::")) {
      const vendor = serviceKey.split("::")[0];
      const apiId = VENDOR_TO_API[vendor] ?? vendor;
      return [vendor, apiId];
    }
    return [serviceKey, serviceKey];
  }

  private buildFinalServiceKey(
    serviceKey: string,
    apiId: string,
    responseOrChunk: AnyObj
  ): string {
    if (!serviceKey.includes("::")) {
      const model = responseOrChunk?.model ?? null;
      if (model) {
        const vendor = API_TO_VENDOR[apiId] ?? apiId;
        return `${vendor}::${model}`;
      }
    }
    return serviceKey;
  }

  private resolveParams(
    customerKey?: string,
    context?: Record<string, unknown>
  ): [string | null, Record<string, unknown> | null] {
    const resolvedKey = customerKey ?? this.customerKey;
    const resolvedCtx = context ?? this.context;
    return [resolvedKey, resolvedCtx];
  }

  private buildRecord(
    serviceKey: string,
    usage: Record<string, unknown>,
    opts: {
      responseId?: string;
      timestamp?: string | Date;
      customerKey?: string | null;
      context?: Record<string, unknown> | null;
    }
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {
      service_key: serviceKey,
      response_id: opts.responseId ?? crypto.randomUUID(),
      timestamp: this.resolveTimestamp(opts.timestamp),
      payload: usage,
    };
    if (opts.customerKey != null) record.customer_key = opts.customerKey;
    if (opts.context != null) record.context = opts.context;
    return record;
  }

  private resolveTimestamp(ts?: string | Date): string {
    if (ts instanceof Date) return String(ts.getTime() / 1000);
    if (typeof ts === "string") return String(new Date(ts).getTime() / 1000);
    return String(Date.now() / 1000);
  }

  // ── Core tracking ──

  async track(
    serviceKey: string,
    usage: Record<string, unknown>,
    options?: TrackOptions
  ): Promise<DeliveryResult> {
    const [customerKey, context] = this.resolveParams(
      options?.customerKey,
      options?.context
    );

    const record = this.buildRecord(serviceKey, usage, {
      responseId: options?.responseId,
      timestamp: options?.timestamp,
      customerKey,
      context,
    });

    return this.delivery.send([record]);
  }

  async trackBatch(records: TrackBatchRecord[]): Promise<Record<string, unknown>> {
    if (records.length > 1000) {
      throw new BatchSizeLimitExceeded(records.length, 1000);
    }
    if (records.length === 0) {
      return { results: [] };
    }

    const builtRecords = records.map((r) => {
      const [customerKey, context] = this.resolveParams(
        r.customerKey,
        r.context
      );
      return this.buildRecord(r.serviceKey, r.usage, {
        responseId: r.responseId,
        timestamp: r.timestamp,
        customerKey,
        context,
      });
    });

    return this.delivery.sendBatch(builtRecords);
  }

  // ── LLM tracking ──

  async trackLlmUsage<T>(
    serviceKey: string,
    response: T,
    options?: TrackOptions
  ): Promise<T> {
    const [, apiId] = this.getVendorApiMapping(serviceKey);
    const usage = getUsageFromResponse(response, apiId);

    if (usage && typeof usage === "object" && Object.keys(usage).length > 0) {
      const finalKey = this.buildFinalServiceKey(
        serviceKey,
        apiId,
        response
      );
      const result = await this.track(finalKey, usage, options);

      // Attach tracking metadata to response
      try {
        const r = response as AnyObj;
        r.aicm_response_id = result?.result?.response_id ?? null;
        r.aicm_track_result = result;
      } catch {
        // response may be frozen
      }
    }

    return response;
  }

  async *trackLlmStreamUsage<T>(
    serviceKey: string,
    stream: AsyncIterable<T>,
    options?: TrackOptions
  ): AsyncGenerator<T> {
    const [, apiId] = this.getVendorApiMapping(serviceKey);
    let usageSent = false;

    for await (const chunk of stream) {
      if (!usageSent) {
        const usage = getStreamingUsageFromResponse(chunk, apiId);
        if (usage && typeof usage === "object" && Object.keys(usage).length > 0) {
          // Try to get model from stream or chunk for service key resolution
          const model =
            (stream as AnyObj)?.model ?? (chunk as AnyObj)?.model ?? null;
          const mockResponse = { model };
          const finalKey = this.buildFinalServiceKey(
            serviceKey,
            apiId,
            mockResponse
          );
          await this.track(finalKey, usage, options);
          usageSent = true;
        }
      }
      yield chunk;
    }
  }
}
