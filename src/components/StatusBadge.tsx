import type { ApplicationStatus } from "@/lib/types";

const STYLES: Record<ApplicationStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  BACKGROUND_CLEARED:
    "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  BACKGROUND_FAILED:
    "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  PAYMENT_CLEARED:
    "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30",
  PAYMENT_FAILED:
    "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30",
  ACCEPTED:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Pending",
  BACKGROUND_CLEARED: "Background cleared",
  BACKGROUND_FAILED: "Background failed",
  PAYMENT_CLEARED: "Payment cleared",
  PAYMENT_FAILED: "Payment failed",
  ACCEPTED: "Accepted",
};

export function StatusBadge({
  status,
  showRaw = false,
  className = "",
}: {
  status: ApplicationStatus;
  /** Show the enum value itself rather than the friendly label. */
  showRaw?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STYLES[status]} ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {showRaw ? status : STATUS_LABELS[status]}
    </span>
  );
}
