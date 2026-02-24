/** ImmediateDelivery — synchronous HTTP POST with retry. */

import { requestWithRetry } from "./http.js";
import { NoCostsTrackedException } from "./errors.js";
import { TrackStatus } from "./types.js";
import type { DeliveryResult, TrackResult } from "./types.js";

export interface ImmediateDeliveryConfig {
  apiKey: string;
  baseUrl: string;
  apiUrl: string;
  raiseOnError: boolean;
}

export class ImmediateDelivery {
  private apiKey: string;
  private endpoint: string;
  private bodyKey = "tracked";
  private raiseOnError: boolean;
  private headers: Record<string, string>;

  constructor(config: ImmediateDeliveryConfig) {
    this.apiKey = config.apiKey;
    const root =
      config.baseUrl.replace(/\/+$/, "") +
      config.apiUrl.replace(/\/+$/, "");
    this.endpoint = `${root}/track`;
    this.raiseOnError = config.raiseOnError;
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async send(
    records: Record<string, unknown>[]
  ): Promise<DeliveryResult> {
    const body = { [this.bodyKey]: records };
    try {
      const { statusCode, data } = await requestWithRetry({
        method: "POST",
        url: this.endpoint,
        headers: this.headers,
        body: body as Record<string, unknown>,
      });

      if (statusCode === 0 || statusCode >= 400) {
        const errMsg =
          data && typeof data === "object" && "detail" in data
            ? String((data as Record<string, unknown>).detail)
            : `HTTP ${statusCode}`;
        if (this.raiseOnError) {
          throw new Error(`Delivery failed: ${errMsg}`);
        }
        return { result: null, triggered_limits: {}, error: errMsg };
      }

      const responseData = data as Record<string, unknown>;
      const triggeredLimits =
        (responseData?.triggered_limits as Record<string, unknown>) ?? {};

      let result: TrackResult | null = null;
      const results = responseData?.results;
      if (Array.isArray(results) && results.length > 0) {
        result = (results[0] as TrackResult) ?? null;
      }

      // Check for missing cost events
      const costEvents = result?.cost_events;
      const status = result?.status;
      const errors = result?.errors;
      if (!costEvents) {
        const allowedStatuses = new Set<string>([
          TrackStatus.QUEUED,
          TrackStatus.COMPLETED,
          TrackStatus.ERROR,
          TrackStatus.SERVICE_KEY_UNKNOWN,
        ]);
        if (
          !(typeof status === "string" && allowedStatuses.has(status)) &&
          !(errors && Array.isArray(errors))
        ) {
          throw new NoCostsTrackedException();
        }
      }

      return { result, triggered_limits: triggeredLimits };
    } catch (err) {
      if (this.raiseOnError) throw err;
      return {
        result: null,
        triggered_limits: {},
        error: String(err),
      };
    }
  }

  async sendBatch(
    records: Record<string, unknown>[]
  ): Promise<Record<string, unknown>> {
    const body = { [this.bodyKey]: records };
    const { statusCode, data } = await requestWithRetry({
      method: "POST",
      url: this.endpoint,
      headers: this.headers,
      body: body as Record<string, unknown>,
    });

    if (statusCode === 0 || statusCode >= 400) {
      const errMsg =
        data && typeof data === "object" && "detail" in data
          ? String((data as Record<string, unknown>).detail)
          : `HTTP ${statusCode}`;
      throw new Error(`Batch delivery failed: ${errMsg}`);
    }

    return (data as Record<string, unknown>) ?? {};
  }
}
