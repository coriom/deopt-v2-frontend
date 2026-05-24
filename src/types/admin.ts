export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type AdminEndpointKey =
  | "status"
  | "config"
  | "db"
  | "mmSessions"
  | "executionSummary"
  | "rfqSummary"
  | "optionsSummary"
  | "feeSummary"
  | "feeEvents"
  | "feeVolumes"
  | "feeRebates"
  | "recent";

export type AdminErrorCode =
  | "admin_disabled"
  | "backend_offline"
  | "http_error"
  | "invalid_token"
  | "malformed_response"
  | "missing_token"
  | "unauthorized"
  | "unknown_error";

export type AdminApiErrorDetails = {
  code: AdminErrorCode;
  message: string;
  status?: number;
};

export type AdminEndpointDefinition = {
  key: AdminEndpointKey;
  label: string;
  path: string;
};

export type AdminEndpointSuccess = AdminEndpointDefinition & {
  ok: true;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminEndpointFailure = AdminEndpointDefinition & {
  ok: false;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminEndpointResult =
  | AdminEndpointSuccess
  | AdminEndpointFailure;

export type AdminSnapshot = Record<AdminEndpointKey, AdminEndpointResult>;

export type RecentLimit = 5 | 20 | 50 | 100;

export type AdminLifecycleSuccess = {
  ok: true;
  label: string;
  path: string;
  data: JsonValue;
  fetchedAt: number;
  status: number;
};

export type AdminLifecycleFailure = {
  ok: false;
  label: string;
  path: string;
  error: AdminApiErrorDetails;
  fetchedAt: number;
  status?: number;
};

export type AdminLifecycleResult =
  | AdminLifecycleSuccess
  | AdminLifecycleFailure;
