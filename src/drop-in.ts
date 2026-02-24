/** Drop-in convenience functions for zero-ceremony usage tracking. */

import { Tracker } from "./tracker.js";
import type {
  ConfigureTrackerOptions,
  DeliveryResult,
  TrackOptions,
} from "./types.js";

// ── Module-level state ──

let _tracker: Tracker | null = null;
let _trackerConfig: [string, string, string] = ["", "", ""]; // [apiKey, baseUrl, apiUrl]
const _defaults: Partial<ConfigureTrackerOptions> = {};

export function configureTracker(options: ConfigureTrackerOptions): void {
  if (options.apiKey !== undefined) _defaults.apiKey = options.apiKey;
  if (options.baseUrl !== undefined) _defaults.baseUrl = options.baseUrl;
  if (options.apiUrl !== undefined) _defaults.apiUrl = options.apiUrl;
  if (options.raiseOnError !== undefined)
    _defaults.raiseOnError = options.raiseOnError;
  if (options.customerKey !== undefined)
    _defaults.customerKey = options.customerKey;
  if (options.context !== undefined) _defaults.context = options.context;

  // Rebuild singleton with new config
  const newConfig: [string, string, string] = [
    _defaults.apiKey ?? "",
    _defaults.baseUrl ?? "",
    _defaults.apiUrl ?? "",
  ];
  if (
    newConfig[0] !== _trackerConfig[0] ||
    newConfig[1] !== _trackerConfig[1] ||
    newConfig[2] !== _trackerConfig[2]
  ) {
    _tracker = new Tracker({
      apiKey: _defaults.apiKey,
      baseUrl: _defaults.baseUrl,
      apiUrl: _defaults.apiUrl,
      raiseOnError: _defaults.raiseOnError,
    });
    _trackerConfig = newConfig;
  }

  // Apply instance-level settings
  if (_tracker) {
    if (_defaults.customerKey !== undefined) {
      _tracker.setCustomerKey(_defaults.customerKey);
    }
    if (_defaults.context !== undefined) {
      _tracker.setContext(_defaults.context);
    }
  }
}

function getTracker(): Tracker {
  if (_tracker !== null) return _tracker;
  _tracker = new Tracker({
    apiKey: _defaults.apiKey,
    baseUrl: _defaults.baseUrl,
    apiUrl: _defaults.apiUrl,
    raiseOnError: _defaults.raiseOnError,
  });
  _trackerConfig = [
    _defaults.apiKey ?? "",
    _defaults.baseUrl ?? "",
    _defaults.apiUrl ?? "",
  ];
  if (_defaults.customerKey !== undefined) {
    _tracker.setCustomerKey(_defaults.customerKey);
  }
  if (_defaults.context !== undefined) {
    _tracker.setContext(_defaults.context);
  }
  return _tracker;
}

export async function track(
  serviceKey: string,
  usage: Record<string, unknown>,
  options?: TrackOptions
): Promise<DeliveryResult> {
  return getTracker().track(serviceKey, usage, options);
}

export async function trackLlmUsage<T>(
  serviceKey: string,
  response: T,
  options?: TrackOptions
): Promise<T> {
  return getTracker().trackLlmUsage(serviceKey, response, options);
}
