"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api, type PaymentInput } from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatTzs,
  type VisaApplication,
} from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  DetailRow,
  Field,
  Spinner,
} from "@/components/ui";

const METHOD_LABELS: Record<PaymentInput["method"], string> = {
  MOBILE_MONEY: "Mobile money",
  CARD: "Debit / credit card",
  BANK_TRANSFER: "Bank transfer",
};

export function ApplicationDetail({
  initial,
  justSubmitted,
}: {
  initial: VisaApplication;
  justSubmitted: boolean;
}) {
  const [application, setApplication] = useState(initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState<"check" | "payment" | "refresh" | null>(
    null,
  );

  /** Runs a workflow action and folds the returned application into state. */
  async function run(
    kind: "check" | "payment" | "refresh",
    action: () => Promise<VisaApplication>,
  ) {
    setWorking(kind);
    setActionError(null);
    try {
      setApplication(await action());
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.message
          : "The request could not be completed.",
      );
    } finally {
      setWorking(null);
    }
  }

  const { applicant, backgroundCheck, payments, status } = application;
  const lastPayment = payments.at(-1) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              {applicant.fullname}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted break-all">
              Application {application.id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} showRaw />
            <Button
              variant="secondary"
              loading={working === "refresh"}
              onClick={() =>
                void run("refresh", () => api.getApplication(application.id))
              }
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {justSubmitted ? (
        <Alert tone="success" title="Application submitted">
          Your applicant profile and visa application were created. Run the
          background check to continue.
        </Alert>
      ) : null}

      <Card className="px-5 py-5">
        <WorkflowStepper status={status} />
      </Card>

      {actionError ? (
        <Alert tone="error" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      {/* Whatever the workflow needs next. */}
      {status === "PENDING" ? (
        <Card>
          <CardHeader
            title="Step 2 · Background check"
            description="The Application Service notifies the Security & Background Service."
          />
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <p className="max-w-md text-sm text-muted">
              Screening runs automatically against immigration, criminal-record
              and watch-list datasets. Clearing it unlocks the fee payment.
            </p>
            <Button
              loading={working === "check"}
              onClick={() =>
                void run("check", () => api.runBackgroundCheck(application.id))
              }
            >
              {working === "check" ? "Screening…" : "Run background check"}
            </Button>
          </div>
        </Card>
      ) : null}

      {status === "BACKGROUND_FAILED" ? (
        <Alert tone="error" title="Application rejected">
          The background check flagged this applicant, so the workflow has
          terminated. No fee was charged.
        </Alert>
      ) : null}

      {status === "BACKGROUND_CLEARED" || status === "PAYMENT_FAILED" ? (
        <PaymentPanel
          application={application}
          retry={status === "PAYMENT_FAILED"}
          working={working === "payment"}
          onPay={(input) =>
            void run("payment", () => api.payFee(application.id, input))
          }
        />
      ) : null}

      {status === "ACCEPTED" ? (
        <Alert tone="success" title="Visa approved">
          The fee cleared and the visa was issued. It is valid until{" "}
          <strong>{formatDate(application.expireDate)}</strong>.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Applicant" description="applicant table" />
          <dl className="divide-y divide-line px-5 py-2">
            <DetailRow label="Full name" value={applicant.fullname} />
            <DetailRow
              label="Passport number"
              value={applicant.passportNumber}
              mono
            />
            <DetailRow label="Country" value={applicant.country} />
            <DetailRow label="Gender" value={applicant.gender} />
            <DetailRow label="Phone" value={applicant.phone} />
            <DetailRow label="Email" value={applicant.email} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Visa application" description="visa_application table" />
          <dl className="divide-y divide-line px-5 py-2">
            <DetailRow label="Visa type" value={application.visaType} />
            <DetailRow
              label="Application date"
              value={formatDateTime(application.applicationDate)}
            />
            <DetailRow
              label="Expiry date"
              value={formatDate(application.expireDate)}
            />
            <DetailRow label="Fee" value={formatTzs(application.feeAmount)} />
            <DetailRow
              label="Status"
              value={<StatusBadge status={status} showRaw />}
            />
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Background check"
            description="background_check table"
          />
          {backgroundCheck ? (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                    backgroundCheck.status === "CLEARED"
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                      : "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30"
                  }`}
                >
                  {backgroundCheck.status}
                </span>
                <span className="text-xs text-muted">
                  {formatDateTime(backgroundCheck.checkDate)} ·{" "}
                  {backgroundCheck.checkedBy}
                </span>
              </div>
              <p className="mt-3 text-sm">{backgroundCheck.remarks}</p>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">
              No check has been run yet.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Payment transactions"
            description="payment_trxn table"
          />
          {payments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              No payment has been attempted yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs">
                      {payment.paymentReference}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(payment.paymentDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatTzs(payment.amount)}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        payment.paymentStatus === "SUCCESS"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {payment.paymentStatus}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {lastPayment?.paymentStatus === "SUCCESS" ? (
            <p className="border-t border-line px-5 py-3 text-xs text-muted">
              Receipt reference{" "}
              <span className="font-mono">{lastPayment.paymentReference}</span>.
            </p>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Workflow timeline"
          description="Every status transition recorded across the three services."
        />
        <ol className="space-y-0 px-5 py-4">
          {application.events.map((event, index) => (
            <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
              {index < application.events.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[5px] top-4 h-full w-0.5 bg-line"
                />
              ) : null}
              <span
                aria-hidden
                className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-accent"
              />
              <div className="min-w-0">
                <p className="text-sm">{event.message}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateTime(event.createdAt)} · {event.actor} →{" "}
                  <span className="font-mono">{event.status}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function PaymentPanel({
  application,
  retry,
  working,
  onPay,
}: {
  application: VisaApplication;
  retry: boolean;
  working: boolean;
  onPay: (input: PaymentInput) => void;
}) {
  const [method, setMethod] = useState<PaymentInput["method"]>("MOBILE_MONEY");
  const [payerReference, setPayerReference] = useState(
    application.applicant.phone,
  );
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!payerReference.trim()) {
      setError(
        method === "CARD"
          ? "Enter the card number."
          : "Enter the paying account or phone number.",
      );
      return;
    }
    setError(null);
    onPay({ method, payerReference: payerReference.trim(), simulateFailure });
  }

  return (
    <Card>
      <CardHeader
        title="Step 3 · Pay the visa fee"
        description="Handled by the Payment Service and recorded in payment_trxn."
      />

      {retry ? (
        <div className="px-5 pt-4">
          <Alert tone="warning" title="Previous payment failed">
            The last charge was declined and the application is{" "}
            <code className="font-mono text-xs">PAYMENT_FAILED</code>. You can
            retry the payment below.
          </Alert>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-surface-muted px-4 py-3">
          <div>
            <p className="text-xs text-muted">Amount due</p>
            <p className="text-2xl font-semibold tracking-tight">
              {formatTzs(application.feeAmount)}
            </p>
          </div>
          <p className="text-xs text-muted">
            {application.visaType} visa · valid until{" "}
            {formatDate(application.expireDate)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="method" label="Payment method" required>
            <select
              id="method"
              className="field-input"
              value={method}
              onChange={(event) => {
                const next = event.target.value as PaymentInput["method"];
                setMethod(next);
                setPayerReference(
                  next === "MOBILE_MONEY" ? application.applicant.phone : "",
                );
              }}
            >
              {(
                Object.keys(METHOD_LABELS) as PaymentInput["method"][]
              ).map((value) => (
                <option key={value} value={value}>
                  {METHOD_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="payerReference"
            label={
              method === "CARD"
                ? "Card number"
                : method === "BANK_TRANSFER"
                  ? "Bank account number"
                  : "Mobile money number"
            }
            required
            error={error ?? undefined}
          >
            <input
              id="payerReference"
              className="field-input font-mono"
              value={payerReference}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "payerReference-error" : undefined}
              onChange={(event) => setPayerReference(event.target.value)}
              placeholder={
                method === "CARD" ? "4111 1111 1111 1111" : "+255 712 345 678"
              }
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={simulateFailure}
              onChange={(event) => setSimulateFailure(event.target.checked)}
            />
            Simulate a declined payment (demo)
          </label>
          <Button type="submit" loading={working}>
            {working
              ? "Processing…"
              : `Pay ${formatTzs(application.feeAmount)}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}
