/** Types and interfaces for the AI Cost Manager SDK. */

// ── Enums ──

export enum TrackStatus {
  QUEUED = "queued",
  COMPLETED = "completed",
  ERROR = "error",
  SERVICE_KEY_UNKNOWN = "service_key_unknown",
}

export enum ThresholdType {
  ALERT = "alert",
  LIMIT = "limit",
}

export enum Period {
  DAY = "day",
  MONTH = "month",
}

export enum Granularity {
  DAILY = "daily",
  HOURLY = "hourly",
}

// ── SDK wrapper types ──

export interface APIResponse<T> {
  ok: boolean;
  statusCode: number;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ErrorResponse {
  detail: string;
  code?: string;
}

// ── Track types ──

export interface TrackResult {
  response_id: string;
  status?: TrackStatus | string;
  cost_events?: Record<string, unknown>[];
  errors?: string[];
}

export interface TriggeredLimitPayload {
  version: string;
  public_key: string;
  key_id: string;
  encrypted_payload: string;
}

export interface TrackResponse {
  results: TrackResult[];
  triggered_limits?: TriggeredLimitPayload;
}

export interface TrackedRecord {
  service_key?: string;
  response_id?: string;
  timestamp?: string;
  customer_key?: string;
  context?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface TrackRequest {
  tracked: TrackedRecord[];
  skip_limits?: boolean;
}

// ── Usage types ──

export interface UsageEvent {
  event_id: string;
  config_id: string;
  service_id?: string;
  timestamp: string;
  response_id: string;
  customer_key?: string;
  usage: Record<string, unknown>;
  base_url?: string;
  context?: Record<string, unknown>;
  status: string;
}

export interface UsageRollup {
  customer_key?: string;
  service_id: string;
  date: string;
  quantity: number;
  cost: number;
}

export interface UsageEventFilters {
  customer_key?: string;
  config_id?: string;
  service_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface RollupFilters {
  customer_key?: string;
  service_id?: string;
  granularity?: Granularity;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// ── Customer types ──

export interface CustomerIn {
  customer_key: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface CustomerOut {
  uuid: string;
  customer_key: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface CustomerFilters {
  customer_key?: string;
  name?: string;
  address?: string;
  phone?: string;
  limit?: number;
  offset?: number;
}

// ── Limit types ──

export interface UsageLimitIn {
  threshold_type: ThresholdType;
  amount: number | string;
  period: Period;
  service_key?: string;
  client?: string;
  team_uuid?: string;
  api_key_uuid?: string;
  notification_list?: string[];
  active?: boolean;
}

export interface UsageLimitOut {
  uuid: string;
  threshold_type: ThresholdType;
  amount: number | string;
  period: Period;
  service?: string;
  client?: string;
  notification_list?: string[];
  active: boolean;
}

export interface UsageLimitProgressOut extends UsageLimitOut {
  current_spend: number | string;
  remaining_amount: number | string;
}

export interface LimitEventOut {
  uuid: string;
  limit_id: string;
  triggered_at: string;
  sent_at?: string;
  expires_at?: string;
}

// ── Service types ──

/** One rate of a catalog model, e.g. `cost` USD per `per_quantity` input tokens. */
export interface CostUnitOut {
  name: string;
  cost: number;
  per_quantity: number;
  currency: string;
  unit: string;
}

export interface PricingModelMetadata {
  release_date?: string | null;
  last_updated_date?: string | null;
  knowledge_cutoff?: string | null;
  model_family?: string | null;
  model_status?: string | null;
  default_temperature?: number | null;
  supports_reasoning?: boolean;
  supports_tool_call?: boolean;
  supports_structured_output?: boolean;
  is_open_weights?: boolean;
  input_modalities?: string[];
  output_modalities?: string[];
  max_input_tokens?: number | null;
}

/**
 * A model in the AICM pricing catalog. `id` is `<provider_id>::<model_name>`,
 * the key usage is tracked under. `first_seen_at` is when AICM first listed it.
 */
export interface PricingModel {
  id: string;
  model_name: string;
  provider: string;
  provider_id?: string | null;
  first_seen_at?: string | null;
  input_price?: CostUnitOut | null;
  output_price?: CostUnitOut | null;
  input_audio_price?: number | null;
  output_audio_price?: number | null;
  context_over_200k_price?: number | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  metadata?: PricingModelMetadata | null;
  benchmark?: Record<string, unknown> | null;
}

export interface ListModelsOptions {
  /** A provider id such as "anthropic". */
  provider?: string;
  /** Only models AICM first listed at or after this time (a zone-less string is UTC). */
  since?: Date | string;
}

// ── Cost Event types ──

export interface CostEventItem {
  provider_id: string;
  service_key: string;
  cost_unit_id: string;
  quantity: number | string;
  cost_per_unit: number | string;
  cost: number | string;
}

export interface CostEventsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CostEventItem[];
}

export interface CostEventFilters {
  response_id?: string;
  api_key_id?: string[];
  customer_key?: string[];
  service_key?: string[];
  start_date?: string;
  end_date?: string;
}

export interface ApiCostEventOut {
  uuid: string;
  event_id: string;
  team_id: string;
  api_key_id: string;
  timestamp: string;
  customer_key?: string;
  response_id: string;
  provider_id: string;
  service_key: string;
  cost_unit_id: string;
  quantity: number | string;
  cost_per_unit: number | string;
  cost: number | string;
  context?: Record<string, unknown>;
  hourly_rollup_status: string;
  daily_rollup_status: string;
}

// ── Webhook types ──

export interface WebhookEndpointCreate {
  url: string;
  secret: string;
  purpose?: string;
  active?: boolean;
  tolerance?: number;
}

export interface WebhookEndpointOut {
  uuid: string;
  url: string;
  purpose: string;
  active: boolean;
  tolerance: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpointsResponse {
  endpoints: WebhookEndpointOut[];
  total_count: number;
  active_count: number;
}

export interface WebhookEndpointUpdate {
  url?: string;
  secret?: string;
  purpose?: string;
  active?: boolean;
  tolerance?: number;
}

// ── Custom Service types ──

export interface CustomCostUnitIn {
  name: string;
  cost: number | string;
  unit: string;
  per_quantity?: number;
  min_units?: number;
  max_units?: number;
  currency?: string;
  is_active?: boolean;
}

export interface CustomCostUnitOut {
  name: string;
  cost: number | string;
  unit: string;
  per_quantity: number;
  min_units: number;
  max_units: number;
  currency: string;
  is_active: boolean;
}

export interface RoundingConfig {
  mode: string;
  increment?: number;
}

export interface Condition {
  equals?: Record<string, unknown>;
  regex?: Record<string, unknown>;
}

export interface CostUnitSwitch {
  field: string;
  cases: Record<string, string>;
  default: string;
}

export interface Mapping {
  cost_unit?: string;
  cost_unit_switch?: CostUnitSwitch;
  field: string;
  divide_by?: number;
  multiply_by?: number;
  min_value?: number;
  max_value?: number;
  rounding?: RoundingConfig;
  only_if?: Condition;
}

export interface MappingGroup {
  when: Condition;
  mappings: Mapping[];
}

export interface CustomServiceConfiguration {
  cost_units: CustomCostUnitIn[];
  mappings?: Mapping[];
  mapping_groups?: MappingGroup[];
  exclusions?: Condition[];
}

export interface CustomServiceIn {
  custom_service_key: string;
  configuration: CustomServiceConfiguration;
  is_active?: boolean;
}

export interface CustomServiceSummaryOut {
  uuid: string;
  custom_service_key: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  cost_units_count: number;
}

export interface CustomServiceOut {
  uuid: string;
  custom_service_key: string;
  configuration: CustomServiceConfiguration;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  cost_units: CustomCostUnitOut[];
  team_uuid: string;
  team_name: string;
}

export interface CustomServiceFilter {
  is_active?: boolean;
  is_deleted?: boolean;
  has_cost_units?: boolean;
}

// ── Tracker config types ──

export interface TrackOptions {
  responseId?: string;
  timestamp?: string | Date;
  customerKey?: string;
  context?: Record<string, unknown>;
}

export interface TrackBatchRecord {
  serviceKey: string;
  usage: Record<string, unknown>;
  responseId?: string;
  timestamp?: string | Date;
  customerKey?: string;
  context?: Record<string, unknown>;
}

export interface TrackerConfig {
  apiKey?: string;
  baseUrl?: string;
  apiUrl?: string;
  raiseOnError?: boolean;
}

export interface ConfigureTrackerOptions extends TrackerConfig {
  customerKey?: string;
  context?: Record<string, unknown>;
}

// ── Delivery result types ──

export interface DeliveryResult {
  result: TrackResult | null;
  triggered_limits: Record<string, unknown>;
  error?: string;
}
