import type {
  AdminApiErrorDetails,
  AdminEndpointDefinition,
  AdminEndpointResult,
  AdminErrorCode,
  AdminLifecycleSuccess,
  AdminSnapshot,
  JsonObject,
  JsonValue,
  RecentLimit,
} from "@/types/admin";

export const RECENT_LIMITS = [5, 20, 50, 100] as const satisfies readonly RecentLimit[];

const STATIC_ADMIN_ENDPOINTS = [
  { key: "status", label: "Status", path: "/admin/status" },
  { key: "config", label: "Config", path: "/admin/config" },
  { key: "db", label: "Database", path: "/admin/db" },
  { key: "mmSessions", label: "MM Sessions", path: "/admin/mm/sessions" },
  {
    key: "executionSummary",
    label: "Execution Summary",
    path: "/admin/execution/summary",
  },
  { key: "rfqSummary", label: "RFQ Summary", path: "/admin/rfq/summary" },
  {
    key: "optionsSummary",
    label: "Options Summary",
    path: "/admin/options/summary",
  },
] as const satisfies readonly AdminEndpointDefinition[];

export function getAdminBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  return (configuredUrl || "http://127.0.0.1:8080").replace(/\/+$/, "");
}

export function getAdminEndpointDefinitions(
  recentLimit: RecentLimit,
  feeEventsLimit: RecentLimit,
  feeAccount: string,
): AdminEndpointDefinition[] {
  const normalizedFeeAccount = feeAccount.trim();
  const feeAccountQuery = normalizedFeeAccount
    ? `?account=${encodeURIComponent(normalizedFeeAccount)}`
    : "";

  return [
    ...STATIC_ADMIN_ENDPOINTS,
    { key: "feeSummary", label: "Fee Summary", path: "/admin/fees/summary" },
    {
      key: "feeEvents",
      label: "Recent Fee Events",
      path: `/admin/fees/events?limit=${normalizeRecentLimit(feeEventsLimit)}`,
    },
    {
      key: "feeVolumes",
      label: "Volume Buckets",
      path: `/admin/fees/volumes${feeAccountQuery}`,
    },
    {
      key: "feeRebates",
      label: "Rebate Accruals",
      path: `/admin/fees/rebates${feeAccountQuery}`,
    },
    {
      key: "recent",
      label: "Recent Activity",
      path: `/admin/recent?limit=${normalizeRecentLimit(recentLimit)}`,
    },
  ];
}

export function normalizeRecentLimit(value: number): RecentLimit {
  if (value === 5 || value === 20 || value === 50 || value === 100) {
    return value;
  }

  return 20;
}

export class AdminApiError extends Error {
  code: AdminErrorCode;
  status?: number;

  constructor(details: AdminApiErrorDetails) {
    super(details.message);
    this.name = "AdminApiError";
    this.code = details.code;
    this.status = details.status;
  }

  toDetails(): AdminApiErrorDetails {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
    };
  }
}

export async function fetchAdminSnapshot(
  token: string,
  recentLimit: RecentLimit,
  feeEventsLimit: RecentLimit,
  feeAccount: string,
  signal?: AbortSignal,
): Promise<AdminSnapshot> {
  const entries = await Promise.all(
    getAdminEndpointDefinitions(recentLimit, feeEventsLimit, feeAccount).map(async (endpoint) => {
      try {
        const result = await fetchAdminEndpoint(endpoint, token, signal);
        return [endpoint.key, result] as const;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        const details = toAdminErrorDetails(error);
        return [
          endpoint.key,
          {
            ...endpoint,
            ok: false,
            error: details,
            fetchedAt: Date.now(),
            status: details.status,
          },
        ] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as AdminSnapshot;
}

export async function fetchOptionExecutionLifecycle(
  token: string,
  intentId: string,
  signal?: AbortSignal,
): Promise<AdminLifecycleSuccess> {
  const normalizedIntentId = intentId.trim();
  const path = `/admin/options/executions/${encodeURIComponent(
    normalizedIntentId,
  )}/lifecycle`;
  const result = await fetchAdminPath({ path }, token, signal);

  return {
    data: result.data,
    fetchedAt: result.fetchedAt,
    label: "Option Execution Lifecycle",
    ok: true,
    path,
    status: result.status,
  };
}

async function fetchAdminEndpoint(
  endpoint: AdminEndpointDefinition,
  token: string,
  signal?: AbortSignal,
): Promise<AdminEndpointResult> {
  const result = await fetchAdminPath(endpoint, token, signal);

  return {
    ...endpoint,
    ...result,
    ok: true,
  };
}

async function fetchAdminPath(
  endpoint: { path: string },
  token: string,
  signal?: AbortSignal,
) {
  const headers = new Headers({
    Accept: "application/json",
  });

  const trimmedToken = token.trim();
  if (trimmedToken) {
    headers.set("X-Admin-Token", trimmedToken);
  }

  let response: Response;
  try {
    response = await fetch(`${getAdminBaseUrl()}${endpoint.path}`, {
      cache: "no-store",
      headers,
      method: "GET",
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new AdminApiError({
      code: "backend_offline",
      message: "Backend offline or unreachable.",
    });
  }

  const parsed = await parseJsonResponse(response, endpoint.path);

  if (!response.ok) {
    const message = extractErrorMessage(parsed, response.statusText);
    throw new AdminApiError({
      code: classifyAdminError(message, response.status),
      message,
      status: response.status,
    });
  }

  return {
    ok: true,
    data: parsed,
    fetchedAt: Date.now(),
    status: response.status,
  };
}

async function parseJsonResponse(
  response: Response,
  path: string,
): Promise<JsonValue> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    throw new AdminApiError({
      code: "malformed_response",
      message: `Malformed JSON response from ${path}.`,
      status: response.status,
    });
  }
}

function extractErrorMessage(value: JsonValue, fallback: string) {
  if (isJsonObject(value)) {
    const error = value.error;
    const message = value.message;

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback || "Admin request failed.";
}

function classifyAdminError(message: string, status?: number): AdminErrorCode {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("admin api is disabled")) {
    return "admin_disabled";
  }

  if (lowerMessage.includes("invalid") && lowerMessage.includes("token")) {
    return "invalid_token";
  }

  if (
    lowerMessage.includes("token") &&
    (lowerMessage.includes("required") || lowerMessage.includes("missing"))
  ) {
    return "missing_token";
  }

  if (status === 401 || status === 403) {
    return "unauthorized";
  }

  return "http_error";
}

export function toAdminErrorDetails(error: unknown): AdminApiErrorDetails {
  if (error instanceof AdminApiError) {
    return error.toDetails();
  }

  if (error instanceof Error) {
    return {
      code: "unknown_error",
      message: error.message || "Unknown admin request error.",
    };
  }

  return {
    code: "unknown_error",
    message: "Unknown admin request error.",
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
