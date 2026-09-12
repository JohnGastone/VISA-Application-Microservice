/**
 * Backend selection for the BFF route handlers.
 *
 * The UI always talks to its own `/api/*` routes. Those routes then use one of
 * three backends, chosen by environment variable:
 *
 *   live        `APPLICATION_SERVICE_URL` set — the real microservices behind
 *               the API gateway. Shapes are adapted in `upstream.ts`.
 *   mock        ...plus `APPLICATION_SERVICE_MOCK=true` — a Postman mock of
 *               `public/visa-api.postman_collection.json`, replaying examples.
 *   simulation  nothing set — the stateful in-memory model in `store.ts`.
 *
 *   APPLICATION_SERVICE_PREFIX   Path prefix on the upstream. Defaults to
 *                                `/api`, which is what the deployed gateway
 *                                serves; use an empty string for a Postman
 *                                mock, whose paths start at `/applications`.
 *   APPLICATION_SERVICE_API_KEY  Sent as `x-api-key` when set.
 *   APPLICATION_SEED_IDS         Comma-separated application ids to show on
 *                                the dashboard, since the live API has no list
 *                                endpoint.
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
import * as upstream from "./upstream";

const BASE_URL = process.env.APPLICATION_SERVICE_URL?.replace(/\/$/, "");

const PREFIX = (process.env.APPLICATION_SERVICE_PREFIX ?? "/api").replace(
  /\/$/,
  "",
);

const API_KEY = process.env.APPLICATION_SERVICE_API_KEY;

const IS_MOCK = process.env.APPLICATION_SERVICE_MOCK === "true";

export type BackendMode = "simulation" | "mock" | "live";

export const backendMode: BackendMode = !BASE_URL
  ? "simulation"
  : IS_MOCK
    ? "mock"
    : "live";

/** True when the backend runs the background check on its own. */
export const screeningIsAutomatic = backendMode === "live";

const target = BASE_URL
  ? upstream.makeUpstream(BASE_URL, PREFIX, API_KEY)
  : null;

/* -------------------------------------------------------------------------- */
/* Postman mock transport                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A mock replays saved examples and ignores the request body, so each call
 * names the example it wants: five collection requests share
 * `POST /applications`, and the decline path has to be asked for explicitly.
 */
async function fromMock<T>(
  path: string,
  example: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-mock-response-name": example,
  };
  if (init.body) headers["Content-Type"] = "application/json";
  if (API_KEY) headers["x-api-key"] = API_KEY;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${PREFIX}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (cause) {
    throw new WorkflowError(
      `Cannot reach the mock at ${BASE_URL}. ${
        cause instanceof Error ? cause.message : "Connection failed."
      }`,
      502,
    );
  }

  const text = await response.text();

  if (!response.ok) {
    let message = text || `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; detail?: string };
      message = parsed.message ?? parsed.detail ?? message;
    } catch {
      // Not JSON: keep the raw body as the message.
    }
    throw new WorkflowError(message, response.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WorkflowError(
      `The mock returned a non-JSON response (${response.status}).`,
      502,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

export async function fetchApplications(): Promise<VisaApplication[]> {
  if (!target) return listApplications();
  if (IS_MOCK) {
    return fromMock<VisaApplication[]>("/applications", "200 · Dashboard list");
  }
  return upstream.fetchApplications(target);
}

export async function fetchApplication(id: string): Promise<VisaApplication> {
  if (!target) return getApplication(id);
  if (IS_MOCK) {
    return fromMock<VisaApplication>(
      `/applications/${id}`,
      "200 · Awaiting payment",
    );
  }
  return upstream.fetchApplication(target, id);
}

export async function submitApplication(
  payload: SubmitApplicationPayload,
): Promise<VisaApplication> {
  if (!target) return createApplication(payload);
  if (IS_MOCK) {
    return fromMock<VisaApplication>("/applications", "201 · Created", {
      method: "POST",
      body: payload,
    });
  }
  return upstream.submitApplication(target, payload);
}

/**
 * Live, screening is automatic and there is no endpoint to trigger it, so this
 * re-reads the application; the UI polls it while the status is PENDING.
 */
export async function requestBackgroundCheck(
  id: string,
): Promise<VisaApplication> {
  if (!target) return runBackgroundCheck(id);
  if (IS_MOCK) {
    return fromMock<VisaApplication>(
      `/applications/${id}/background-check`,
      "200 · Cleared",
      { method: "POST" },
    );
  }
  return upstream.refreshBackgroundCheck(target, id);
}

export async function submitPayment(
  id: string,
  request: PaymentRequest,
): Promise<VisaApplication> {
  if (!target) return processPayment(id, request);
  if (IS_MOCK) {
    return fromMock<VisaApplication>(
      `/applications/${id}/payments`,
      request.simulateFailure ? "201 · Declined" : "201 · Paid and accepted",
      { method: "POST", body: request },
    );
  }
  return upstream.payFee(target, id, request);
}
