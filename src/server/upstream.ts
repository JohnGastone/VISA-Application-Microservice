/**
 * Client for the live visa services behind the API gateway.
 *
 * The deployed API is shaped differently from the resource this UI renders, so
 * everything is adapted here rather than in the components. Verified against
 * the gateway on 12 Sep 2026:
 *
 *   POST /api/applications                        flat body, returns PENDING
 *   GET  /api/applications/{id}                   application, no children
 *   GET  /api/applicants                          full applicant records
 *   GET  /api/background-checks/{applicationId}   404 until screening lands
 *   GET  /api/payments/{applicationId}            404 until paid
 *   POST /api/payments/{applicationId}/pay        charges, application ACCEPTED
 *
 * Three differences drive the mapping below:
 *
 *  1. An application carries only `applicantFullName`, so the applicant's
 *     passport, country and contact details are joined from `/api/applicants`.
 *  2. The background check runs automatically after submission — there is no
 *     endpoint to trigger it, so the UI polls instead.
 *  3. There is no list endpoint and no event trail, so the dashboard is built
 *     from the ids this server has seen, and the timeline is derived from the
 *     timestamps on the application, check and payment.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Applicant,
  type ApplicationEvent,
  type ApplicationStatus,
  type BackgroundCheck,
  type Gender,
  type PaymentTransaction,
  type SubmitApplicationPayload,
  type VisaApplication,
  type VisaType,
} from "@/lib/types";
import { WorkflowError, type PaymentRequest } from "./store";

/* -------------------------------------------------------------------------- */
/* Upstream payloads                                                          */
/* -------------------------------------------------------------------------- */

interface UpstreamApplication {
  id: string;
  applicantId: string;
  applicantFullName: string;
  applicationDate: string;
  visaType: VisaType;
  expireDate: string;
  status: ApplicationStatus;
}

interface UpstreamApplicant {
  id: string;
  fullname: string;
  passportNumber: string;
  country: string;
  gender: string;
  phone: string;
  email: string;
}

interface UpstreamBackgroundCheck {
  id: string;
  visaApplicationId: string;
  status: "CLEARED" | "FAILED";
  remarks: string;
  checkDate: string;
  checkedBy: string;
}

interface UpstreamPayment {
  id: string;
  visaApplicationId: string;
  paymentReference: string;
  amount: number;
  paymentStatus: "SUCCESS" | "FAILED";
  paymentDate: string;
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

interface Upstream {
  baseUrl: string;
  prefix: string;
  apiKey?: string;
}

/** Thrown for a 404, which several endpoints use to mean "not yet". */
class NotFound extends Error {}

async function send<T>(
  upstream: Upstream,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body) headers["Content-Type"] = "application/json";
  if (upstream.apiKey) headers["x-api-key"] = upstream.apiKey;

  let response: Response;
  try {
    response = await fetch(`${upstream.baseUrl}${upstream.prefix}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (cause) {
    throw new WorkflowError(
      `Cannot reach the visa services at ${upstream.baseUrl}. ${
        cause instanceof Error ? cause.message : "Connection failed."
      }`,
      502,
    );
  }

  const text = await response.text();

  if (response.status === 404) throw new NotFound(text);

  if (!response.ok) {
    throw new WorkflowError(explain(text, response), response.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WorkflowError(
      `The visa services returned a non-JSON response (${response.status}).`,
      502,
    );
  }
}

/**
 * The services answer with RFC 7807 `application/problem+json`, where the
 * useful text is in `detail`; the gateway itself uses `error`.
 */
function explain(text: string, response: Response): string {
  try {
    const problem = JSON.parse(text) as {
      detail?: string;
      title?: string;
      error?: string;
      message?: string;
    };
    return (
      problem.detail ??
      problem.message ??
      problem.title ??
      problem.error ??
      `${response.status} ${response.statusText}`
    );
  } catch {
    return text || `${response.status} ${response.statusText}`;
  }
}

async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFound) return null;
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Known application ids                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `GET /api/applications` does not exist upstream — the route is POST-only —
 * so the dashboard can only show applications this server knows the id of:
 * those submitted through the UI, any opened by id, and any listed in
 * `APPLICATION_SEED_IDS`.
 *
 * Only the index of ids is local. Every application on the dashboard is
 * fetched live from the services on each request, so the data itself is always
 * the database's. The index is written to disk so it survives a restart.
 */
const INDEX_FILE = join(process.cwd(), ".visa-known-applications.json");

const globalRegistry = globalThis as unknown as { __visaSeenIds?: Set<string> };

function seen(): Set<string> {
  if (globalRegistry.__visaSeenIds) return globalRegistry.__visaSeenIds;

  const ids = new Set(
    (process.env.APPLICATION_SEED_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  try {
    const stored = JSON.parse(readFileSync(INDEX_FILE, "utf8")) as unknown;
    if (Array.isArray(stored)) {
      for (const id of stored) if (typeof id === "string") ids.add(id);
    }
  } catch {
    // No index yet, or unreadable: start from the seed ids alone.
  }

  globalRegistry.__visaSeenIds = ids;
  return ids;
}

function remember(id: string): void {
  const ids = seen();
  if (ids.has(id)) return;
  ids.add(id);
  persist();
}

function forget(id: string): void {
  if (seen().delete(id)) persist();
}

function persist(): void {
  try {
    writeFileSync(INDEX_FILE, JSON.stringify([...seen()], null, 2));
  } catch {
    // A read-only deployment keeps the index in memory for this process only.
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

function normaliseGender(value: string): Gender {
  const upper = value?.toUpperCase();
  return upper === "MALE" || upper === "FEMALE" ? upper : "OTHER";
}

/** Fills in an applicant when `/api/applicants` has no match for the id. */
function placeholderApplicant(row: UpstreamApplication): Applicant {
  return {
    id: row.applicantId,
    fullname: row.applicantFullName,
    passportNumber: "—",
    country: "—",
    gender: "OTHER",
    phone: "—",
    email: "—",
  };
}

function toApplicant(row: UpstreamApplicant): Applicant {
  return {
    id: row.id,
    fullname: row.fullname,
    passportNumber: row.passportNumber,
    country: row.country,
    gender: normaliseGender(row.gender),
    phone: row.phone,
    email: row.email,
  };
}

function toCheck(row: UpstreamBackgroundCheck): BackgroundCheck {
  return {
    id: row.id,
    applicationId: row.visaApplicationId,
    status: row.status,
    remarks: row.remarks,
    checkDate: row.checkDate,
    checkedBy: row.checkedBy,
  };
}

function toPayment(row: UpstreamPayment): PaymentTransaction {
  return {
    id: row.id,
    applicationId: row.visaApplicationId,
    paymentReference: row.paymentReference,
    amount: row.amount,
    currency: "TZS",
    paymentStatus: row.paymentStatus,
    paymentDate: row.paymentDate,
  };
}

/**
 * The services keep no event log, so the timeline is reconstructed from the
 * timestamps that do exist. Every entry is something the API actually reports.
 */
function deriveEvents(
  row: UpstreamApplication,
  check: BackgroundCheck | null,
  payment: PaymentTransaction | null,
): ApplicationEvent[] {
  const events: ApplicationEvent[] = [
    {
      id: `${row.id}-submitted`,
      applicationId: row.id,
      type: "SUBMITTED",
      message: `${row.visaType} visa application submitted by ${row.applicantFullName}.`,
      status: "PENDING",
      createdAt: row.applicationDate,
      actor: "APPLICANT",
    },
  ];

  if (check) {
    const cleared = check.status === "CLEARED";
    events.push({
      id: `${row.id}-check`,
      applicationId: row.id,
      type: "BACKGROUND_CHECK",
      message: cleared
        ? `Automated background check cleared the applicant. ${check.remarks}`
        : `Automated background check flagged the applicant. ${check.remarks}`,
      status: cleared ? "BACKGROUND_CLEARED" : "BACKGROUND_FAILED",
      createdAt: check.checkDate,
      actor: check.checkedBy,
    });
  }

  if (payment) {
    const paid = payment.paymentStatus === "SUCCESS";
    events.push({
      id: `${row.id}-payment`,
      applicationId: row.id,
      type: "PAYMENT",
      message: paid
        ? `Payment of ${payment.amount.toLocaleString()} TZS received (ref ${payment.paymentReference}).`
        : `Payment of ${payment.amount.toLocaleString()} TZS was declined (ref ${payment.paymentReference}).`,
      status: paid ? "PAYMENT_CLEARED" : "PAYMENT_FAILED",
      createdAt: payment.paymentDate,
      actor: "PAYMENT_SERVICE",
    });
  }

  if (row.status === "ACCEPTED") {
    events.push({
      id: `${row.id}-decision`,
      applicationId: row.id,
      type: "DECISION",
      message: `Visa approved. ${row.visaType} visa valid until ${row.expireDate}.`,
      status: "ACCEPTED",
      createdAt: payment?.paymentDate ?? row.applicationDate,
      actor: "APPLICATION_SERVICE",
    });
  }

  return events;
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                */
/* -------------------------------------------------------------------------- */

async function applicantsById(
  upstream: Upstream,
): Promise<Map<string, Applicant>> {
  const rows =
    (await optional(send<UpstreamApplicant[]>(upstream, "/applicants"))) ?? [];
  return new Map(rows.map((row) => [row.id, toApplicant(row)]));
}

/** Joins one application with its applicant, check and payment. */
async function compose(
  upstream: Upstream,
  row: UpstreamApplication,
  applicants?: Map<string, Applicant>,
): Promise<VisaApplication> {
  const [checkRow, paymentRow, lookup] = await Promise.all([
    optional(
      send<UpstreamBackgroundCheck>(upstream, `/background-checks/${row.id}`),
    ),
    optional(send<UpstreamPayment>(upstream, `/payments/${row.id}`)),
    applicants ? Promise.resolve(applicants) : applicantsById(upstream),
  ]);

  const check = checkRow ? toCheck(checkRow) : null;
  const payment = paymentRow ? toPayment(paymentRow) : null;

  return {
    id: row.id,
    applicantId: row.applicantId,
    applicant: lookup.get(row.applicantId) ?? placeholderApplicant(row),
    applicationDate: row.applicationDate,
    visaType: row.visaType,
    expireDate: row.expireDate,
    status: row.status,
    // The application resource carries no fee upstream, so the amount is
    // known only once a payment exists. The UI shows nothing rather than a
    // guess.
    feeAmount: payment?.amount ?? null,
    backgroundCheck: check,
    payments: payment ? [payment] : [],
    events: deriveEvents(row, check, payment),
  };
}

/* -------------------------------------------------------------------------- */
/* Operations used by the BFF routes                                          */
/* -------------------------------------------------------------------------- */

export async function fetchApplications(
  upstream: Upstream,
): Promise<VisaApplication[]> {
  const ids = [...seen()];
  if (ids.length === 0) return [];

  const applicants = await applicantsById(upstream);

  const rows = await Promise.all(
    ids.map((id) =>
      optional(send<UpstreamApplication>(upstream, `/applications/${id}`)),
    ),
  );

  const applications = await Promise.all(
    rows
      .filter((row): row is UpstreamApplication => row !== null)
      .map((row) => compose(upstream, row, applicants)),
  );

  // Drop ids the services no longer recognise, so the dashboard stays honest.
  for (const [index, row] of rows.entries()) {
    if (row === null) forget(ids[index]);
  }

  return applications.sort((a, b) =>
    b.applicationDate.localeCompare(a.applicationDate),
  );
}

export async function fetchApplication(
  upstream: Upstream,
  id: string,
): Promise<VisaApplication> {
  const row = await optional(
    send<UpstreamApplication>(upstream, `/applications/${id}`),
  );
  if (!row) throw new WorkflowError(`Application ${id} not found`, 404);

  remember(row.id);
  return compose(upstream, row);
}

export async function submitApplication(
  upstream: Upstream,
  payload: SubmitApplicationPayload,
): Promise<VisaApplication> {
  // The upstream expects one flat object, not applicant + visa details.
  const row = await send<UpstreamApplication>(upstream, "/applications", {
    method: "POST",
    body: {
      fullname: payload.applicant.fullname,
      passportNumber: payload.applicant.passportNumber,
      country: payload.applicant.country,
      gender: payload.applicant.gender,
      phone: payload.applicant.phone,
      email: payload.applicant.email,
      visaType: payload.visaType,
      expireDate: payload.expireDate,
    },
  });

  remember(row.id);
  return compose(upstream, row);
}

/**
 * Screening is automatic upstream, so this re-reads the application rather
 * than asking for a check. The UI polls it while the status is PENDING.
 */
export async function refreshBackgroundCheck(
  upstream: Upstream,
  id: string,
): Promise<VisaApplication> {
  return fetchApplication(upstream, id);
}

export async function payFee(
  upstream: Upstream,
  id: string,
  request: PaymentRequest,
): Promise<VisaApplication> {
  const payment = await send<UpstreamPayment>(
    upstream,
    `/payments/${id}/pay`,
    {
      method: "POST",
      // The endpoint takes no body; the channel is sent for the services to
      // log if they choose, and is ignored today.
      body: { method: request.method, payerReference: request.payerReference },
    },
  );

  // The services commit the status change just after the charge returns, so a
  // straight re-read still says BACKGROUND_CLEARED and the UI would offer the
  // payment form again. Give the transition a moment to land.
  const settled = payment.paymentStatus === "SUCCESS" ? "ACCEPTED" : "PAYMENT_FAILED";
  let application = await fetchApplication(upstream, id);

  for (let attempt = 0; attempt < 6 && application.status !== settled; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    application = await fetchApplication(upstream, id);
  }

  return application;
}

export function makeUpstream(
  baseUrl: string,
  prefix: string,
  apiKey?: string,
): Upstream {
  return { baseUrl, prefix, apiKey };
}

export type { Upstream };
