/**
 * Backend selection for the BFF route handlers.
 *
 * The UI always talks to its own `/api/*` routes. Those routes then either
 *
 *  - forward to the real Application Service (when `APPLICATION_SERVICE_URL`
 *    is set, usually the API gateway address), or
 *  - fall back to the in-memory simulation in `store.ts`.
 *
 * That keeps the SPA runnable on its own while making the switch to the real
 * microservices a matter of setting one environment variable.
 */

import type { SubmitApplicationPayload, VisaApplication } from "@/lib/types";
import {
  WorkflowError,
  createApplication,
  getApplication,
  listApplications,
  processPayment,
  runBackgroundCheck,
  type PaymentRequest,
} from "./store";

const BASE_URL = process.env.APPLICATION_SERVICE_URL?.replace(/\/$/, "");

export const backendMode: "live" | "mock" = BASE_URL ? "live" : "mock";

async function call<T>(
  path: string,
  init?: { method: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    let message = detail || `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(detail);
      message = parsed.message ?? parsed.detail ?? message;
    } catch {
      // Not JSON: keep the raw body as the message.
    }
    throw new WorkflowError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function fetchApplications(): Promise<VisaApplication[]> {
  if (!BASE_URL) return listApplications();
  return call<VisaApplication[]>("/api/v1/applications");
}

export async function fetchApplication(id: string): Promise<VisaApplication> {
  if (!BASE_URL) return getApplication(id);
  return call<VisaApplication>(`/api/v1/applications/${id}`);
}

export async function submitApplication(
  payload: SubmitApplicationPayload,
): Promise<VisaApplication> {
  if (!BASE_URL) return createApplication(payload);
  return call<VisaApplication>("/api/v1/applications", {
    method: "POST",
    body: payload,
  });
}

export async function requestBackgroundCheck(
  id: string,
): Promise<VisaApplication> {
  if (!BASE_URL) return runBackgroundCheck(id);
  return call<VisaApplication>(`/api/v1/applications/${id}/background-check`, {
    method: "POST",
  });
}

export async function submitPayment(
  id: string,
  request: PaymentRequest,
): Promise<VisaApplication> {
  if (!BASE_URL) return processPayment(id, request);
  return call<VisaApplication>(`/api/v1/applications/${id}/payments`, {
    method: "POST",
    body: request,
  });
}
