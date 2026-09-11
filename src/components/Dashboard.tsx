"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import {
  APPLICATION_STATUSES,
  formatDateTime,
  formatTzs,
  type ApplicationStatus,
  type VisaApplication,
} from "@/lib/types";
import { STATUS_LABELS, StatusBadge } from "@/components/StatusBadge";
import { Alert, Button, Card } from "@/components/ui";

type Filter = ApplicationStatus | "ALL";

export function Dashboard({ initial }: { initial: VisaApplication[] }) {
  const [applications, setApplications] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setApplications(await api.listApplications());
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not refresh the list of applications.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const counts = useMemo(() => {
    const base = {
      total: applications.length,
      inProgress: 0,
      accepted: 0,
      rejected: 0,
    };
    for (const app of applications) {
      if (app.status === "ACCEPTED") base.accepted += 1;
      else if (app.status === "BACKGROUND_FAILED") base.rejected += 1;
      else base.inProgress += 1;
    }
    return base;
  }, [applications]);

  const collected = useMemo(
    () =>
      applications
        .flatMap((app) => app.payments)
        .filter((payment) => payment.paymentStatus === "SUCCESS")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [applications],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((app) => {
      if (filter !== "ALL" && app.status !== filter) return false;
      if (!needle) return true;
      return (
        app.applicant.fullname.toLowerCase().includes(needle) ||
        app.applicant.passportNumber.toLowerCase().includes(needle) ||
        app.applicant.email.toLowerCase().includes(needle) ||
        app.id.toLowerCase().includes(needle)
      );
    });
  }, [applications, filter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Application dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track every application from{" "}
            <code className="font-mono text-xs">PENDING</code> through to{" "}
            <code className="font-mono text-xs">ACCEPTED</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={refreshing}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
          <Link
            href="/apply"
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:brightness-110"
          >
            New application
          </Link>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total applications" value={String(counts.total)} />
        <Stat label="In progress" value={String(counts.inProgress)} />
        <Stat
          label="Accepted"
          value={String(counts.accepted)}
          tone="positive"
        />
        <Stat label="Fees collected" value={formatTzs(collected)} />
      </dl>

      {error ? (
        <Alert tone="error" title="Something went wrong">
          {error}
        </Alert>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <label className="sr-only" htmlFor="dashboard-search">
            Search applications
          </label>
          <input
            id="dashboard-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, passport, email or ID"
            className="field-input sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
              All
            </FilterChip>
            {APPLICATION_STATUSES.map((status) => (
              <FilterChip
                key={status}
                active={filter === status}
                onClick={() => setFilter(status)}
              >
                {STATUS_LABELS[status]}
              </FilterChip>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium">No applications to show</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {applications.length === 0
                ? "Submit the first visa application to start the workflow."
                : "No application matches the current search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Applicant
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Passport
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Visa type
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Submitted
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Fee
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <tr
                    key={app.id}
                    className="border-b border-line transition last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{app.applicant.fullname}</p>
                      <p className="text-xs text-muted">
                        {app.applicant.country} · {app.applicant.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {app.applicant.passportNumber}
                    </td>
                    <td className="px-4 py-3">{app.visaType}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDateTime(app.applicationDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatTzs(app.feeAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/applications/${app.id}`}
                        className="text-sm font-semibold text-accent hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive";
}) {
  return (
    <div className="card px-4 py-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-1 text-xl font-semibold tracking-tight ${
          tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-accent text-accent-contrast"
          : "border border-line text-muted hover:border-accent/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
