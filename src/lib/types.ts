/**
 * Domain types shared by the UI and the BFF route handlers.
 * These mirror the microservice contracts described in docs/API.md.
 */

export const APPLICATION_STATUSES = [
  "PENDING",
  "BACKGROUND_CLEARED",
  "BACKGROUND_FAILED",
  "PAYMENT_CLEARED",
  "PAYMENT_FAILED",
  "ACCEPTED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const VISA_TYPES = ["TOURIST", "BUSINESS", "STUDENT"] as const;
export type VisaType = (typeof VISA_TYPES)[number];

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export type BackgroundCheckStatus = "CLEARED" | "FAILED";
export type PaymentStatus = "SUCCESS" | "FAILED";

export interface Applicant {
  id: string;
  fullname: string;
  passportNumber: string;
  country: string;
  gender: Gender;
  phone: string;
  email: string;
}

export interface BackgroundCheck {
  id: string;
  applicationId: string;
  status: BackgroundCheckStatus;
  remarks: string;
  checkDate: string;
  checkedBy: string;
}

export interface PaymentTransaction {
  id: string;
  applicationId: string;
  paymentReference: string;
  amount: number;
  currency: "TZS";
  paymentStatus: PaymentStatus;
  paymentDate: string;
}

/**
 * Supporting table `application_event`: an append-only audit trail of the
 * workflow, used to render the timeline on the status page.
 */
export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type:
    | "SUBMITTED"
    | "BACKGROUND_CHECK"
    | "PAYMENT"
    | "STATUS_CHANGE"
    | "DECISION";
  message: string;
  status: ApplicationStatus;
  createdAt: string;
  actor: string;
}

export interface VisaApplication {
  id: string;
  applicantId: string;
  applicant: Applicant;
  applicationDate: string;
  visaType: VisaType;
  expireDate: string;
  status: ApplicationStatus;
  /**
   * Set by the Payment Service. `null` until a payment exists, because the
   * fee is the backend's to decide — the UI never quotes a figure of its own.
   */
  feeAmount: number | null;
  backgroundCheck: BackgroundCheck | null;
  payments: PaymentTransaction[];
  events: ApplicationEvent[];
}

/** Payload accepted by `POST /api/applications`. */
export interface SubmitApplicationPayload {
  applicant: Omit<Applicant, "id">;
  visaType: VisaType;
  expireDate: string;
}

/** Statuses from which no further workflow action is possible. */
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  "BACKGROUND_FAILED",
  "ACCEPTED",
];

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function formatTzs(amount: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("TZS", "TZS ");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
