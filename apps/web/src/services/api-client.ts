/**
 * @file Defines shared frontend services for API requests, errors, or query keys.
 */
import type { ZodType } from "zod";

import { ApiError } from "./api-error.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions<T> {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly formData?: FormData | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly responseSchema?: ZodType<T> | undefined;
}

interface ApiSuccessEnvelope<T> {
  readonly success: true;
  readonly data: T;
}

interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly correlationId?: string | undefined;
  };
}

/**
 * @description Executes the get api base url operation used by the application workflow.
 * @param {unknown} rawValue - Input value for raw value.
 * @returns {string} Result of the get api base url operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export function getApiBaseUrl(rawValue = import.meta.env.VITE_API_BASE_URL): string {
  const value = rawValue || "http://localhost:3000";
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error("VITE_API_BASE_URL must be a valid absolute URL");
  }
}

/**
 * @description Executes the get dev auth headers operation used by the application workflow.
 * @returns {Record<string, string>} Result of the get dev auth headers operation.
 */
export function getDevAuthHeaders(): Record<string, string> {
  return {
    ...(import.meta.env.VITE_DEV_USER_ID ? { "x-user-id": import.meta.env.VITE_DEV_USER_ID } : {}),
    ...(import.meta.env.VITE_DEV_ORGANIZATION_ID
      ? { "x-organization-id": import.meta.env.VITE_DEV_ORGANIZATION_ID }
      : {}),
  };
}

/**
 * @description Performs the parse response body helper operation for this module.
 * @param {Response} response - Input value for response.
 * @returns {Promise<unknown>} Result of the parse response body operation.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return JSON.parse(text);
}

/**
 * @description Performs the to api error helper operation for this module.
 * @param {Response} response - Input value for response.
 * @param {unknown} body - Input value for body.
 * @returns {ApiError} Result of the to api error operation.
 */
function toApiError(response: Response, body: unknown): ApiError {
  const correlationId = response.headers.get("x-correlation-id") ?? undefined;
  const envelope = body as Partial<ApiErrorEnvelope>;

  if (envelope.success === false && envelope.error) {
    return new ApiError({
      status: response.status,
      code: envelope.error.code,
      message: envelope.error.message,
      ...(envelope.error.details ? { details: envelope.error.details } : {}),
      ...((envelope.error.correlationId ?? correlationId)
        ? { correlationId: envelope.error.correlationId ?? correlationId }
        : {}),
    });
  }

  return new ApiError({
    status: response.status,
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
    ...(correlationId ? { correlationId } : {}),
  });
}

/**
 * @description Performs the api request helper operation for this module.
 * @param {string} path - Input value for path.
 * @param {ApiRequestOptions<T>} options - Input value for options.
 * @returns {Promise<T>} Result of the api request operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = new Headers();
  let body: BodyInit | undefined;

  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  for (const [key, value] of Object.entries(getDevAuthHeaders())) {
    headers.set(key, value);
  }

  const requestInit: RequestInit = {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    ...(body ? { body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  const response = await fetch(url, requestInit);

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    throw toApiError(response, responseBody);
  }

  const envelope = responseBody as ApiSuccessEnvelope<T>;
  const data =
    envelope.success === true && "data" in envelope ? envelope.data : (responseBody as T);
  return options.responseSchema ? options.responseSchema.parse(data) : data;
}

/**
 * @description Executes the upload multipart operation used by the application workflow.
 * @param {string} path - Input value for path.
 * @param {FormData} formData - Input value for form data.
 * @param {Omit<ApiRequestOptions<T>, "formData" | "body" | "method">} options - Input value for options.
 * @returns {Promise<T>} Result of the upload multipart operation.
 */
export function uploadMultipart<T>(
  path: string,
  formData: FormData,
  options: Omit<ApiRequestOptions<T>, "formData" | "body" | "method"> = {},
): Promise<T> {
  return apiRequest(path, {
    ...options,
    method: "POST",
    formData,
  });
}
