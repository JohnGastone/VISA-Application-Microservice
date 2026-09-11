import type { SubmitApplicationPayload, VisaApplication } from "./types";

/** Error thrown by every client helper below when a request fails. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Per-field messages returned by a 422, keyed by form field name. */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init?: { method: string; body?: unknown },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the visa services. Check your connection and try again.",
      0,
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload ?? {}) as {
      message?: string;
      fields?: Record<string, string>;
    };
    throw new ApiError(
      error.message ?? `Request failed with status ${response.status}.`,
      response.status,
      error.fields,
    );
  }

  return payload as T;
}

export interface PaymentInput {
  method: "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";
  payerReference: string;
  simulateFailure?: boolean;
}

export const api = {
  listApplications: () => request<VisaApplication[]>("/applications"),

  getApplication: (id: string) =>
    request<VisaApplication>(`/applications/${id}`),

  submitApplication: (payload: SubmitApplicationPayload) =>
    request<VisaApplication>("/applications", {
      method: "POST",
      body: payload,
    }),

  runBackgroundCheck: (id: string) =>
    request<VisaApplication>(`/applications/${id}/background-check`, {
      method: "POST",
    }),

  payFee: (id: string, input: PaymentInput) =>
    request<VisaApplication>(`/applications/${id}/payments`, {
      method: "POST",
      body: input,
    }),
};
