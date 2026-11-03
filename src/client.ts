/** AI Cost Manager API client. */

import { requestWithRetry } from "./http.js";
import type {
  ApiCostEventOut,
  APIResponse,
  CostEventFilters,
  CostEventsResponse,
  CostUnitOut,
  CustomerFilters,
  CustomerIn,
  CustomerOut,
  CustomServiceFilter,
  CustomServiceIn,
  CustomServiceOut,
  CustomServiceSummaryOut,
  ListModelsOptions,
  PaginatedResponse,
  PricingModel,
  RollupFilters,
  UsageEvent,
  UsageEventFilters,
  UsageLimitIn,
  UsageLimitOut,
  UsageLimitProgressOut,
  UsageRollup,
  WebhookEndpointCreate,
  WebhookEndpointOut,
  WebhookEndpointsResponse,
  WebhookEndpointUpdate,
} from "./types.js";

export interface CostManagerClientConfig {
  apiKey?: string;
  baseUrl?: string;
  apiUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filtersToParams(
  filters?: any
): Record<string, string> | undefined {
  if (!filters) return undefined;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      // Repeat key for array values (Django list param style)
      for (const v of value) {
        params[key] = String(v);
      }
    } else {
      params[key] = String(value);
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

export class CostManagerClient {
  private apiKey: string;
  private baseUrl: string;
  private apiUrl: string;
  private teamSlug: string | null = null;

  constructor(config: CostManagerClientConfig = {}) {
    const key =
      config.apiKey ?? process.env.AICM_API_KEY ?? "";
    if (!key) {
      throw new Error(
        "API key is required. Pass apiKey or set AICM_API_KEY environment variable."
      );
    }
    this.apiKey = key;
    this.baseUrl = (
      config.baseUrl ??
      process.env.AICM_API_BASE ??
      "https://aicostmanager.com"
    ).replace(/\/+$/, "");
    this.apiUrl = (
      config.apiUrl ??
      process.env.AICM_API_URL ??
      "/api/v1"
    ).replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private url(path: string): string {
    return `${this.baseUrl}${this.apiUrl}${path}`;
  }

  private async request(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      params?: Record<string, string>;
    }
  ): Promise<{ statusCode: number; data: unknown }> {
    const url = path.startsWith("http") ? path : this.url(path);
    return requestWithRetry({
      method,
      url,
      headers: this.headers(),
      body: options?.body,
      params: options?.params,
    });
  }

  private static extractError(statusCode: number, data: unknown): string {
    if (data && typeof data === "object" && "detail" in data) {
      return String((data as Record<string, unknown>).detail);
    }
    return `HTTP ${statusCode}`;
  }

  private async *iterPaginated<T>(
    path: string,
    params?: Record<string, string>
  ): AsyncGenerator<T> {
    let currentPath = path;
    let currentParams = params;
    while (true) {
      const { statusCode, data } = await this.request("GET", currentPath, {
        params: currentParams,
      });
      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(CostManagerClient.extractError(statusCode, data));
      }
      const page = data as PaginatedResponse<T>;
      for (const item of page.results ?? []) {
        yield item;
      }
      const nextUrl = page.next;
      if (!nextUrl) break;
      currentPath = nextUrl;
      currentParams = undefined;
    }
  }

  // ── Triggered Limits ──

  async getTriggeredLimits(): Promise<APIResponse<Record<string, unknown>>> {
    const { statusCode, data } = await this.request("GET", "/triggered-limits");
    if (statusCode >= 200 && statusCode < 300) {
      return { ok: true, statusCode, data: data as Record<string, unknown> };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Usage Events ──

  async listUsageEvents(
    filters?: UsageEventFilters
  ): Promise<APIResponse<PaginatedResponse<UsageEvent>>> {
    const params = filtersToParams(filters);
    const { statusCode, data } = await this.request("GET", "/usage/events/", {
      params,
    });
    if (statusCode === 200 && data) {
      return {
        ok: true,
        statusCode,
        data: data as PaginatedResponse<UsageEvent>,
      };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async *iterUsageEvents(
    filters?: UsageEventFilters
  ): AsyncGenerator<UsageEvent> {
    const params = filtersToParams(filters);
    yield* this.iterPaginated<UsageEvent>("/usage/events/", params);
  }

  async getUsageEvent(eventId: string): Promise<APIResponse<UsageEvent>> {
    const { statusCode, data } = await this.request(
      "GET",
      `/usage/event/${eventId}/`
    );
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as UsageEvent };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Usage Rollups ──

  async listUsageRollups(
    filters?: RollupFilters
  ): Promise<APIResponse<PaginatedResponse<UsageRollup>>> {
    const params = filtersToParams(filters);
    const { statusCode, data } = await this.request("GET", "/usage/rollups/", {
      params,
    });
    if (statusCode === 200 && data) {
      return {
        ok: true,
        statusCode,
        data: data as PaginatedResponse<UsageRollup>,
      };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async *iterUsageRollups(filters?: RollupFilters): AsyncGenerator<UsageRollup> {
    const params = filtersToParams(filters);
    yield* this.iterPaginated<UsageRollup>("/usage/rollups/", params);
  }

  // ── Customers ──

  async listCustomers(
    filters?: CustomerFilters
  ): Promise<APIResponse<PaginatedResponse<CustomerOut>>> {
    const params = filtersToParams(filters);
    const { statusCode, data } = await this.request("GET", "/customers/", {
      params,
    });
    if (statusCode === 200 && data) {
      return {
        ok: true,
        statusCode,
        data: data as PaginatedResponse<CustomerOut>,
      };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async *iterCustomers(
    filters?: CustomerFilters
  ): AsyncGenerator<CustomerOut> {
    const params = filtersToParams(filters);
    yield* this.iterPaginated<CustomerOut>("/customers/", params);
  }

  async createCustomer(
    data: CustomerIn
  ): Promise<APIResponse<CustomerOut>> {
    const { statusCode, data: resp } = await this.request("POST", "/customers/", {
      body: data as unknown as Record<string, unknown>,
    });
    if (statusCode === 201 && resp) {
      return { ok: true, statusCode, data: resp as CustomerOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async getCustomer(customerId: string): Promise<APIResponse<CustomerOut>> {
    const { statusCode, data } = await this.request(
      "GET",
      `/customers/${customerId}/`
    );
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as CustomerOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async updateCustomer(
    customerId: string,
    data: CustomerIn
  ): Promise<APIResponse<CustomerOut>> {
    const { statusCode, data: resp } = await this.request(
      "PUT",
      `/customers/${customerId}/`,
      { body: data as unknown as Record<string, unknown> }
    );
    if (statusCode === 200 && resp) {
      return { ok: true, statusCode, data: resp as CustomerOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async deleteCustomer(customerId: string): Promise<APIResponse<null>> {
    const { statusCode, data } = await this.request(
      "DELETE",
      `/customers/${customerId}/`
    );
    if (statusCode === 204) {
      return { ok: true, statusCode, data: null };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Usage Limits ──

  async listUsageLimits(): Promise<APIResponse<UsageLimitOut[]>> {
    const { statusCode, data } = await this.request("GET", "/usage-limits/");
    if (statusCode === 200 && Array.isArray(data)) {
      return { ok: true, statusCode, data: data as UsageLimitOut[] };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async createUsageLimit(
    data: UsageLimitIn
  ): Promise<APIResponse<UsageLimitOut>> {
    const { statusCode, data: resp } = await this.request(
      "POST",
      "/usage-limits/",
      { body: data as unknown as Record<string, unknown> }
    );
    if (statusCode === 201 && resp) {
      return { ok: true, statusCode, data: resp as UsageLimitOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async getUsageLimit(limitId: string): Promise<APIResponse<UsageLimitOut>> {
    const { statusCode, data } = await this.request(
      "GET",
      `/usage-limits/${limitId}/`
    );
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as UsageLimitOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async updateUsageLimit(
    limitId: string,
    data: UsageLimitIn
  ): Promise<APIResponse<UsageLimitOut>> {
    const { statusCode, data: resp } = await this.request(
      "PUT",
      `/usage-limits/${limitId}/`,
      { body: data as unknown as Record<string, unknown> }
    );
    if (statusCode === 200 && resp) {
      return { ok: true, statusCode, data: resp as UsageLimitOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async deleteUsageLimit(limitId: string): Promise<APIResponse<null>> {
    const { statusCode, data } = await this.request(
      "DELETE",
      `/usage-limits/${limitId}/`
    );
    if (statusCode === 204) {
      return { ok: true, statusCode, data: null };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async listUsageLimitProgress(): Promise<
    APIResponse<UsageLimitProgressOut[]>
  > {
    const { statusCode, data } = await this.request(
      "GET",
      "/usage-limits/progress/"
    );
    if (statusCode === 200 && Array.isArray(data)) {
      return { ok: true, statusCode, data: data as UsageLimitProgressOut[] };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Model catalog ──

  /**
   * Every model in the AICM pricing catalog, across all providers. Pass the
   * newest `first_seen_at` from the previous call as `since` to poll for new
   * models; the unfiltered catalog is over 10,000 models.
   */
  async listModels(
    options: ListModelsOptions = {}
  ): Promise<APIResponse<PricingModel[]>> {
    const params: Record<string, string> = {};
    if (options.since != null) {
      params.since =
        options.since instanceof Date
          ? options.since.toISOString()
          : options.since;
    }
    if (options.provider) params.provider = options.provider;
    const { statusCode, data } = await this.request("GET", "/pricing/models", {
      params,
    });
    if (statusCode === 200 && data) {
      const models = (data as { models: PricingModel[] }).models;
      return { ok: true, statusCode, data: models };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  /** One catalog model by its id, `<provider_id>::<model_name>`. */
  async getModel(modelId: string): Promise<APIResponse<PricingModel>> {
    const { statusCode, data } = await this.request(
      "GET",
      `/pricing/models/${modelId}`
    );
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as PricingModel };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Cost Events ──

  async listCostEvents(
    filters?: CostEventFilters
  ): Promise<APIResponse<CostEventsResponse>> {
    const params = filtersToParams(filters);
    const { statusCode, data } = await this.request("GET", "/costs/", {
      params,
    });
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as CostEventsResponse };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async listCostEventsByResponseId(
    responseId: string
  ): Promise<APIResponse<ApiCostEventOut[]>> {
    const { statusCode, data } = await this.request(
      "GET",
      `/cost-events/${responseId}`
    );
    if (statusCode === 200 && Array.isArray(data)) {
      return { ok: true, statusCode, data: data as ApiCostEventOut[] };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Webhooks ──

  /** Webhooks live under the API key's team, whose slug is looked up once. */
  private async webhooksPath(webhookUuid?: string): Promise<string | null> {
    if (this.teamSlug === null) {
      const { statusCode, data } = await this.request("GET", "/teams/");
      const teams = data as { slug: string }[] | null;
      if (statusCode !== 200 || !Array.isArray(teams) || !teams.length) {
        return null;
      }
      this.teamSlug = teams[0].slug;
    }
    const path = `/teams/${this.teamSlug}/webhooks/`;
    return webhookUuid ? `${path}${webhookUuid}/` : path;
  }

  private static noTeam<T>(): APIResponse<T> {
    return { ok: false, statusCode: 404, error: "Team for this API key not found" };
  }

  async createWebhookEndpoint(
    data: WebhookEndpointCreate
  ): Promise<APIResponse<WebhookEndpointOut>> {
    const path = await this.webhooksPath();
    if (!path) return CostManagerClient.noTeam();
    const { statusCode, data: resp } = await this.request("POST", path, {
      body: data as unknown as Record<string, unknown>,
    });
    if (statusCode === 201 && resp) {
      return { ok: true, statusCode, data: resp as WebhookEndpointOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async listWebhookEndpoints(
    activeOnly = false
  ): Promise<APIResponse<WebhookEndpointsResponse>> {
    const path = await this.webhooksPath();
    if (!path) return CostManagerClient.noTeam();
    const { statusCode, data } = await this.request("GET", path);
    if (statusCode === 200 && Array.isArray(data)) {
      const endpoints = (data as WebhookEndpointOut[]).filter(
        (e) => e.active || !activeOnly
      );
      return {
        ok: true,
        statusCode,
        data: {
          endpoints,
          total_count: endpoints.length,
          active_count: endpoints.filter((e) => e.active).length,
        },
      };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async getWebhookEndpoint(
    webhookUuid: string
  ): Promise<APIResponse<WebhookEndpointOut>> {
    const path = await this.webhooksPath(webhookUuid);
    if (!path) return CostManagerClient.noTeam();
    const { statusCode, data } = await this.request("GET", path);
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as WebhookEndpointOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async updateWebhookEndpoint(
    webhookUuid: string,
    data: WebhookEndpointUpdate
  ): Promise<APIResponse<WebhookEndpointOut>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) body[key] = value;
    }
    const path = await this.webhooksPath(webhookUuid);
    if (!path) return CostManagerClient.noTeam();
    const { statusCode, data: resp } = await this.request("PATCH", path, {
      body,
    });
    if (statusCode === 200 && resp) {
      return { ok: true, statusCode, data: resp as WebhookEndpointOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async deleteWebhookEndpoint(webhookUuid: string): Promise<APIResponse<null>> {
    const path = await this.webhooksPath(webhookUuid);
    if (!path) return CostManagerClient.noTeam();
    const { statusCode, data } = await this.request("DELETE", path);
    if (statusCode === 204) {
      return { ok: true, statusCode, data: null };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── Custom Services ──

  async listCustomServices(
    filters?: CustomServiceFilter
  ): Promise<APIResponse<CustomServiceSummaryOut[]>> {
    const params = filtersToParams(filters);
    const { statusCode, data } = await this.request(
      "GET",
      "/custom-services/",
      { params }
    );
    if (statusCode === 200 && Array.isArray(data)) {
      return {
        ok: true,
        statusCode,
        data: data as CustomServiceSummaryOut[],
      };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async createCustomService(
    data: CustomServiceIn
  ): Promise<APIResponse<CustomServiceOut>> {
    const { statusCode, data: resp } = await this.request(
      "POST",
      "/custom-services/",
      { body: data as unknown as Record<string, unknown> }
    );
    if (statusCode === 201 && resp) {
      return { ok: true, statusCode, data: resp as CustomServiceOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async getCustomService(
    uuid: string
  ): Promise<APIResponse<CustomServiceOut>> {
    const { statusCode, data } = await this.request(
      "GET",
      `/custom-services/${uuid}/`
    );
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data: data as CustomServiceOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  async updateCustomService(
    uuid: string,
    data: CustomServiceIn
  ): Promise<APIResponse<CustomServiceOut>> {
    const { statusCode, data: resp } = await this.request(
      "PUT",
      `/custom-services/${uuid}/`,
      { body: data as unknown as Record<string, unknown> }
    );
    if (statusCode === 200 && resp) {
      return { ok: true, statusCode, data: resp as CustomServiceOut };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, resp),
    };
  }

  async deleteCustomService(uuid: string): Promise<APIResponse<null>> {
    const { statusCode, data } = await this.request(
      "DELETE",
      `/custom-services/${uuid}/`
    );
    if (statusCode === 204) {
      return { ok: true, statusCode, data: null };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }

  // ── OpenAPI Schema ──

  async getOpenapiSchema(): Promise<APIResponse<unknown>> {
    const { statusCode, data } = await this.request("GET", "/openapi.json");
    if (statusCode === 200 && data) {
      return { ok: true, statusCode, data };
    }
    return {
      ok: false,
      statusCode,
      error: CostManagerClient.extractError(statusCode, data),
    };
  }
}
