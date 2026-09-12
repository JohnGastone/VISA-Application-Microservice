/**
 * In-memory simulation of the three microservices, used by the BFF route
 * handlers whenever no real service URLs are configured (see `gateway.ts`).
 *
 * It keeps the UI fully demonstrable on its own and documents the exact
 * contract the Spring Boot / FastAPI services are expected to honour:
 *
 *   Application Service        -> applicants, visa_application
 *   Security & Background Svc  -> background_check
 *   Payment Service            -> payment_trxn
 */

import {
  type Applicant,
  type ApplicationEvent,
  type ApplicationStatus,
  type BackgroundCheck,
  type PaymentTransaction,
  type SubmitApplicationPayload,
  type VisaApplication,
  type VisaType,
} from "@/lib/types";

/**
 * Fee table for the simulated Payment Service only. A real backend owns its
 * own pricing and reports it on the transaction.
 */
const SIMULATED_FEES: Record<VisaType, number> = {
  TOURIST: 130_000,
  BUSINESS: 650_000,
  STUDENT: 260_000,
};

export interface PaymentRequest {
  /** Channel the applicant paid with; recorded on the transaction reference. */
  method: "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";
  payerReference: string;
  /** Demo switch that forces the Payment Service to decline the charge. */
  simulateFailure?: boolean;
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 409,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

interface StoreShape {
  applicants: Map<string, Applicant>;
  applications: Map<string, ApplicationRow>;
  backgroundChecks: Map<string, BackgroundCheck>;
  payments: Map<string, PaymentTransaction[]>;
  events: Map<string, ApplicationEvent[]>;
  sequence: number;
}

/** The persisted shape of a `visa_application` row (no joined data). */
interface ApplicationRow {
  id: string;
  applicantId: string;
  applicationDate: string;
  visaType: VisaType;
  expireDate: string;
  status: ApplicationStatus;
  feeAmount: number;
}

// Survives hot reloads in development, where modules are re-evaluated.
const globalStore = globalThis as unknown as { __visaStore?: StoreShape };

function emptyStore(): StoreShape {
  return {
    applicants: new Map(),
    applications: new Map(),
    backgroundChecks: new Map(),
    payments: new Map(),
    events: new Map(),
    sequence: 0,
  };
}

function store(): StoreShape {
  if (!globalStore.__visaStore) {
    globalStore.__visaStore = emptyStore();
    seed(globalStore.__visaStore);
  }
  return globalStore.__visaStore;
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function reference(prefix: string, db: StoreShape): string {
  db.sequence += 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(db.sequence).padStart(5, "0")}`;
}

function addEvent(
  db: StoreShape,
  applicationId: string,
  event: Omit<ApplicationEvent, "id" | "applicationId">,
): void {
  const list = db.events.get(applicationId) ?? [];
  list.push({ id: uuid(), applicationId, ...event });
  db.events.set(applicationId, list);
}

/** Joins a row with the data owned by the other two services. */
function hydrate(db: StoreShape, row: ApplicationRow): VisaApplication {
  const applicant = db.applicants.get(row.applicantId);
  if (!applicant) {
    throw new WorkflowError(`Applicant ${row.applicantId} not found`, 500);
  }
  return {
    ...row,
    applicant,
    backgroundCheck: db.backgroundChecks.get(row.id) ?? null,
    payments: db.payments.get(row.id) ?? [],
    events: [...(db.events.get(row.id) ?? [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Application Service                                                        */
/* -------------------------------------------------------------------------- */

export function listApplications(): VisaApplication[] {
  const db = store();
  return [...db.applications.values()]
    .map((row) => hydrate(db, row))
    .sort((a, b) => b.applicationDate.localeCompare(a.applicationDate));
}

export function getApplication(id: string): VisaApplication {
  const db = store();
  const row = db.applications.get(id);
  if (!row) throw new WorkflowError(`Application ${id} not found`, 404);
  return hydrate(db, row);
}

export function createApplication(
  payload: SubmitApplicationPayload,
): VisaApplication {
  const db = store();
  const passport = payload.applicant.passportNumber.toUpperCase();

  const duplicate = [...db.applicants.values()].find(
    (a) => a.passportNumber === passport,
  );

  // `passport_number` is unique: reuse the profile instead of rejecting a
  // returning applicant, but refuse a second application still in flight.
  const applicant: Applicant = duplicate
    ? { ...duplicate, ...payload.applicant, passportNumber: passport }
    : { id: uuid(), ...payload.applicant, passportNumber: passport };
  db.applicants.set(applicant.id, applicant);

  if (duplicate) {
    const inFlight = [...db.applications.values()].find(
      (row) =>
        row.applicantId === applicant.id &&
        !["ACCEPTED", "BACKGROUND_FAILED"].includes(row.status),
    );
    if (inFlight) {
      throw new WorkflowError(
        `Passport ${passport} already has an application in progress (${inFlight.id}).`,
        409,
      );
    }
  }

  const now = new Date().toISOString();
  const row: ApplicationRow = {
    id: uuid(),
    applicantId: applicant.id,
    applicationDate: now,
    visaType: payload.visaType,
    expireDate: payload.expireDate,
    status: "PENDING",
    feeAmount: SIMULATED_FEES[payload.visaType],
  };
  db.applications.set(row.id, row);

  addEvent(db, row.id, {
    type: "SUBMITTED",
    message: `${payload.visaType} visa application submitted by ${applicant.fullname}.`,
    status: "PENDING",
    createdAt: now,
    actor: "APPLICANT",
  });

  return hydrate(db, row);
}

/* -------------------------------------------------------------------------- */
/* Security & Background Service                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic stand-in for the real screening engine so demos are
 * repeatable: a passport beginning with `X`, or a full name containing
 * "flag", is treated as a watch-list hit.
 */
function screen(applicant: Applicant): { cleared: boolean; remarks: string } {
  const flagged =
    applicant.passportNumber.startsWith("X") ||
    applicant.fullname.toLowerCase().includes("flag");

  if (flagged) {
    return {
      cleared: false,
      remarks: `Watch-list match on passport ${applicant.passportNumber}. Manual review required before any visa can be issued.`,
    };
  }
  return {
    cleared: true,
    remarks: `No adverse records found for ${applicant.fullname} (${applicant.country}). Interpol, immigration and criminal-record datasets checked.`,
  };
}

export function runBackgroundCheck(id: string): VisaApplication {
  const db = store();
  const row = db.applications.get(id);
  if (!row) throw new WorkflowError(`Application ${id} not found`, 404);

  if (row.status !== "PENDING") {
    throw new WorkflowError(
      `Background check can only run on a PENDING application (current status: ${row.status}).`,
    );
  }

  const applicant = db.applicants.get(row.applicantId)!;
  const { cleared, remarks } = screen(applicant);
  const now = new Date().toISOString();

  const check: BackgroundCheck = {
    id: uuid(),
    applicationId: row.id,
    status: cleared ? "CLEARED" : "FAILED",
    remarks,
    checkDate: now,
    checkedBy: "SYSTEM_AUTO",
  };
  db.backgroundChecks.set(row.id, check);

  row.status = cleared ? "BACKGROUND_CLEARED" : "BACKGROUND_FAILED";

  addEvent(db, row.id, {
    type: "BACKGROUND_CHECK",
    message: cleared
      ? "Automated background check cleared the applicant."
      : "Automated background check flagged the applicant. Workflow terminated.",
    status: row.status,
    createdAt: now,
    actor: "SYSTEM_AUTO",
  });

  return hydrate(db, row);
}

/* -------------------------------------------------------------------------- */
/* Payment Service                                                            */
/* -------------------------------------------------------------------------- */

export function processPayment(
  id: string,
  request: PaymentRequest,
): VisaApplication {
  const db = store();
  const row = db.applications.get(id);
  if (!row) throw new WorkflowError(`Application ${id} not found`, 404);

  if (!["BACKGROUND_CLEARED", "PAYMENT_FAILED"].includes(row.status)) {
    throw new WorkflowError(
      `Payment is only accepted after the background check clears (current status: ${row.status}).`,
    );
  }

  const now = new Date().toISOString();
  const success = !request.simulateFailure;

  const trxn: PaymentTransaction = {
    id: uuid(),
    applicationId: row.id,
    paymentReference: reference(success ? "TZS" : "TZSF", db),
    amount: row.feeAmount,
    currency: "TZS",
    paymentStatus: success ? "SUCCESS" : "FAILED",
    paymentDate: now,
  };
  db.payments.set(row.id, [...(db.payments.get(row.id) ?? []), trxn]);

  if (!success) {
    row.status = "PAYMENT_FAILED";
    addEvent(db, row.id, {
      type: "PAYMENT",
      message: `${request.method.replace("_", " ")} charge of ${row.feeAmount.toLocaleString()} TZS was declined (ref ${trxn.paymentReference}). The applicant may retry.`,
      status: row.status,
      createdAt: now,
      actor: "PAYMENT_SERVICE",
    });
    return hydrate(db, row);
  }

  row.status = "PAYMENT_CLEARED";
  addEvent(db, row.id, {
    type: "PAYMENT",
    message: `${request.method.replace("_", " ")} payment of ${row.feeAmount.toLocaleString()} TZS received (ref ${trxn.paymentReference}).`,
    status: row.status,
    createdAt: now,
    actor: "PAYMENT_SERVICE",
  });

  // A cleared payment is the last gate, so the Application Service issues the
  // visa immediately afterwards.
  row.status = "ACCEPTED";
  addEvent(db, row.id, {
    type: "DECISION",
    message: `Visa approved. ${row.visaType} visa valid until ${row.expireDate}.`,
    status: "ACCEPTED",
    createdAt: new Date(Date.now() + 1000).toISOString(),
    actor: "APPLICATION_SERVICE",
  });

  return hydrate(db, row);
}

/* -------------------------------------------------------------------------- */
/* Demo data                                                                  */
/* -------------------------------------------------------------------------- */

export function resetStore(): void {
  globalStore.__visaStore = emptyStore();
  seed(globalStore.__visaStore);
}

/**
 * Populates demo data. The caller must have already installed `db` as the
 * active store, since the seed goes through the public workflow functions so
 * the demo rows carry a realistic event trail.
 */
function seed(db: StoreShape): void {
  if (globalStore.__visaStore !== db) {
    throw new Error("seed() requires the store to be installed first");
  }
  {
    // Accepted end-to-end
    const accepted = createApplication({
      applicant: {
        fullname: "Amina Hassan",
        passportNumber: "TZ4471203",
        country: "Tanzania",
        gender: "FEMALE",
        phone: "+255 712 345 678",
        email: "amina.hassan@example.com",
      },
      visaType: "BUSINESS",
      expireDate: isoDate(210),
    });
    runBackgroundCheck(accepted.id);
    processPayment(accepted.id, {
      method: "MOBILE_MONEY",
      payerReference: "+255 712 345 678",
    });

    // Awaiting payment
    const cleared = createApplication({
      applicant: {
        fullname: "David Mwangi",
        passportNumber: "KE8820114",
        country: "Kenya",
        gender: "MALE",
        phone: "+254 733 998 210",
        email: "david.mwangi@example.com",
      },
      visaType: "TOURIST",
      expireDate: isoDate(90),
    });
    runBackgroundCheck(cleared.id);

    // Background failed (watch-list rule)
    const failed = createApplication({
      applicant: {
        fullname: "Viktor Petrov",
        passportNumber: "X99120045",
        country: "United Kingdom",
        gender: "MALE",
        phone: "+44 7700 900 123",
        email: "viktor.petrov@example.com",
      },
      visaType: "BUSINESS",
      expireDate: isoDate(120),
    });
    runBackgroundCheck(failed.id);

    // Still pending
    createApplication({
      applicant: {
        fullname: "Grace Okafor",
        passportNumber: "NG5512877",
        country: "Nigeria",
        gender: "FEMALE",
        phone: "+234 802 445 1190",
        email: "grace.okafor@example.com",
      },
      visaType: "STUDENT",
      expireDate: isoDate(365),
    });
  }
}

function isoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}
