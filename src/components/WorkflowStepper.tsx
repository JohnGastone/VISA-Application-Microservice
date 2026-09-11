import type { ApplicationStatus } from "@/lib/types";

type StepState = "done" | "current" | "failed" | "upcoming";

interface Step {
  key: string;
  title: string;
  caption: string;
  service: string;
}

const STEPS: Step[] = [
  {
    key: "submission",
    title: "Submitted",
    caption: "Applicant profile and visa application created",
    service: "Application Service",
  },
  {
    key: "background",
    title: "Background check",
    caption: "Automated screening against watch lists",
    service: "Security & Background Service",
  },
  {
    key: "payment",
    title: "Payment",
    caption: "Visa fee collected in TZS",
    service: "Payment Service",
  },
  {
    key: "decision",
    title: "Decision",
    caption: "Visa issued to the applicant",
    service: "Application Service",
  },
];

/** Maps a status onto the state of each of the four workflow steps. */
function stateFor(status: ApplicationStatus, index: number): StepState {
  const table: Record<ApplicationStatus, StepState[]> = {
    PENDING: ["done", "current", "upcoming", "upcoming"],
    BACKGROUND_FAILED: ["done", "failed", "upcoming", "upcoming"],
    BACKGROUND_CLEARED: ["done", "done", "current", "upcoming"],
    PAYMENT_FAILED: ["done", "done", "failed", "upcoming"],
    PAYMENT_CLEARED: ["done", "done", "done", "current"],
    ACCEPTED: ["done", "done", "done", "done"],
  };
  return table[status][index];
}

const MARKER: Record<StepState, string> = {
  done: "border-accent bg-accent text-accent-contrast",
  current: "border-accent bg-surface text-accent animate-pulse-ring",
  failed: "border-rose-500 bg-rose-500 text-white",
  upcoming: "border-line bg-surface-muted text-muted",
};

export function WorkflowStepper({ status }: { status: ApplicationStatus }) {
  return (
    <ol className="grid gap-0 sm:grid-cols-4">
      {STEPS.map((step, index) => {
        const state = stateFor(status, index);
        const isLast = index === STEPS.length - 1;

        return (
          <li key={step.key} className="relative flex gap-3 pb-6 sm:block sm:pb-0">
            {/* Connector: vertical on mobile, horizontal from sm up. */}
            {!isLast ? (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 h-full w-0.5 sm:left-7 sm:top-[13px] sm:h-0.5 sm:w-full ${
                  state === "done" ? "bg-accent" : "bg-line"
                }`}
              />
            ) : null}

            <span
              className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${MARKER[state]}`}
            >
              {state === "done" ? "✓" : state === "failed" ? "✕" : index + 1}
            </span>

            <div className="min-w-0 sm:mt-3 sm:pr-4">
              <p
                className={`text-sm font-semibold ${
                  state === "upcoming" ? "text-muted" : ""
                }`}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{step.caption}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-accent">
                {step.service}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
