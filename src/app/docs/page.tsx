import type { Metadata } from "next";
import { Erd } from "@/components/Erd";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardHeader } from "@/components/ui";
import { APPLICATION_STATUSES } from "@/lib/types";

export const metadata: Metadata = {
  title: "ERD & API · Visa Application Portal",
  description:
    "Entity relationship diagram and REST API reference for the visa application microservices.",
};

const SERVICES = [
  {
    name: "Application Service",
    owns: "applicant, visa_application, application_event",
    role: "Creates applicant profiles and applications, orchestrates the workflow and owns the status field.",
  },
  {
    name: "Security & Background Service",
    owns: "background_check",
    role: "Screens the applicant and reports CLEARED or FAILED back to the Application Service.",
  },
  {
    name: "Payment Service",
    owns: "payment_trxn",
    role: "Charges the visa fee in TZS and reports SUCCESS or FAILED per transaction.",
  },
];

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/applications",
    purpose: "List every application with its applicant, check and payments.",
    response: "200 VisaApplication[]",
  },
  {
    method: "POST",
    path: "/api/applications",
    purpose:
      "Create the applicant profile and a visa application with status PENDING.",
    response: "201 VisaApplication · 422 field errors",
  },
  {
    method: "GET",
    path: "/api/applications/{id}",
    purpose: "Fetch one application for the status page.",
    response: "200 VisaApplication · 404",
  },
  {
    method: "POST",
    path: "/api/applications/{id}/background-check",
    purpose:
      "Ask the Security Service to screen the applicant. Moves PENDING to BACKGROUND_CLEARED or BACKGROUND_FAILED.",
    response: "200 VisaApplication · 409 wrong status",
  },
  {
    method: "POST",
    path: "/api/applications/{id}/payments",
    purpose:
      "Charge the fee. Moves BACKGROUND_CLEARED to PAYMENT_CLEARED then ACCEPTED, or to PAYMENT_FAILED.",
    response: "201 VisaApplication · 409 wrong status",
  },
];

const TRANSITIONS = [
  { from: "—", event: "Application submitted", to: "PENDING" },
  { from: "PENDING", event: "Background check cleared", to: "BACKGROUND_CLEARED" },
  { from: "PENDING", event: "Background check flagged", to: "BACKGROUND_FAILED" },
  { from: "BACKGROUND_CLEARED", event: "Payment succeeded", to: "PAYMENT_CLEARED" },
  { from: "BACKGROUND_CLEARED", event: "Payment declined", to: "PAYMENT_FAILED" },
  { from: "PAYMENT_FAILED", event: "Payment retried and succeeded", to: "PAYMENT_CLEARED" },
  { from: "PAYMENT_CLEARED", event: "Visa issued", to: "ACCEPTED" },
];

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          ERD &amp; API reference
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The schema and endpoints this SPA is built against. The UI talks only
          to its own <code className="font-mono text-xs">/api/*</code> routes,
          which forward to whatever{" "}
          <code className="font-mono text-xs">APPLICATION_SERVICE_URL</code>{" "}
          points at — the real services, or a Postman mock of the collection
          below — and otherwise serve an in-memory simulation.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Where the data is coming from"
          description="Set by environment variables; no code changes needed to switch."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Backend
                </th>
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Configuration
                </th>
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Behaviour
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line align-top">
                <td className="px-5 py-3 font-medium">In-memory simulation</td>
                <td className="px-5 py-3 font-mono text-xs text-muted">
                  nothing set
                </td>
                <td className="px-5 py-3 text-muted">
                  Stateful. Real transitions, guard rails and seeded demo data.
                </td>
              </tr>
              <tr className="border-b border-line align-top">
                <td className="px-5 py-3 font-medium">
                  Postman mock of the collection
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted">
                  APPLICATION_SERVICE_URL=&lt;mock&gt;
                  <br />
                  APPLICATION_SERVICE_PREFIX=
                  <br />
                  APPLICATION_SERVICE_MOCK=true
                </td>
                <td className="px-5 py-3 text-muted">
                  Stateless. Replays saved examples, so each screen shows its
                  scripted response. Run it locally with{" "}
                  <code className="font-mono text-xs">npm run dev:mock</code>.
                </td>
              </tr>
              <tr className="align-top">
                <td className="px-5 py-3 font-medium">Real microservices</td>
                <td className="px-5 py-3 font-mono text-xs text-muted">
                  APPLICATION_SERVICE_URL=&lt;base&gt;
                  <br />
                  APPLICATION_SERVICE_PREFIX=/api/v1
                </td>
                <td className="px-5 py-3 text-muted">
                  Stateful, once the services honour the contract below.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Services"
          description="Three independent services, each owning its own tables."
        />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          {SERVICES.map((service) => (
            <div key={service.name}>
              <p className="text-sm font-semibold">{service.name}</p>
              <p className="mt-1 font-mono text-[11px] text-accent">
                {service.owns}
              </p>
              <p className="mt-2 text-xs text-muted">{service.role}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Entity relationship diagram"
          description="PK primary key · FK foreign key · UQ unique constraint"
        />
        <div className="overflow-x-auto px-5 py-5">
          <Erd />
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          <code className="font-mono">application_event</code> is the one
          supporting table added beyond the specified schema; it stores the
          append-only audit trail rendered as the workflow timeline.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Status workflow"
          description="The status column on visa_application follows exactly these transitions."
        />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {APPLICATION_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} showRaw />
          ))}
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-lg border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">From</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Event</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">To</th>
              </tr>
            </thead>
            <tbody>
              {TRANSITIONS.map((row) => (
                <tr
                  key={`${row.from}-${row.to}-${row.event}`}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-5 py-2.5 font-mono text-xs">{row.from}</td>
                  <td className="px-5 py-2.5 text-muted">{row.event}</td>
                  <td className="px-5 py-2.5 font-mono text-xs">{row.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="REST endpoints"
          description="Consumed by the SPA; mirrored by the Application Service under /api/v1."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">Method</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Path</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Purpose</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Response</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((endpoint) => (
                <tr
                  key={`${endpoint.method}-${endpoint.path}`}
                  className="border-b border-line last:border-0 align-top"
                >
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                        endpoint.method === "GET"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{endpoint.path}</td>
                  <td className="px-5 py-3 text-muted">{endpoint.purpose}</td>
                  <td className="px-5 py-3 font-mono text-[11px]">
                    {endpoint.response}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3 text-xs text-muted">
          <p>
            Machine-readable contracts:{" "}
            <a
              href="/openapi.json"
              className="font-mono text-accent hover:underline"
            >
              /openapi.json
            </a>{" "}
            loads straight into Swagger UI, and{" "}
            <a
              href="/visa-api.postman_collection.json"
              className="font-mono text-accent hover:underline"
            >
              /visa-api.postman_collection.json
            </a>{" "}
            imports into Postman.
          </p>
          <p className="mt-1.5">
            The collection runs end to end — it walks one application from{" "}
            <code className="font-mono">PENDING</code> to{" "}
            <code className="font-mono">ACCEPTED</code>, then checks every guard
            rail. Point its <code className="font-mono">baseUrl</code> variable
            at your service to verify it against the real backend:{" "}
            <code className="font-mono">
              newman run visa-api.postman_collection.json --env-var
              baseUrl=http://localhost:8080/api/v1
            </code>
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Fees"
          description="Owned by the Payment Service, never by this UI."
        />
        <p className="px-5 py-4 text-sm text-muted">
          A visa type does not carry a price here. The amount is whatever the
          Payment Service charges, and it reaches the UI on the transaction as{" "}
          <code className="font-mono text-xs">amount</code> with{" "}
          <code className="font-mono text-xs">currency: &quot;TZS&quot;</code>.
          Until a payment exists the UI shows no figure rather than guessing
          one. Expose <code className="font-mono text-xs">feeAmount</code> on
          the application resource and it will be quoted before payment too.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Demo screening rules"
          description="The simulated Security Service is deterministic so demos repeat."
        />
        <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-sm text-muted">
          <li>
            A passport number starting with{" "}
            <code className="font-mono text-xs">X</code>, or a full name
            containing &ldquo;flag&rdquo;, is treated as a watch-list hit and
            fails the check.
          </li>
          <li>Every other applicant clears.</li>
          <li>
            Payments succeed unless{" "}
            <em>Simulate a declined payment</em> is ticked on the payment form,
            which exercises the{" "}
            <code className="font-mono text-xs">PAYMENT_FAILED</code> branch and
            the retry path.
          </li>
        </ul>
      </Card>
    </div>
  );
}
