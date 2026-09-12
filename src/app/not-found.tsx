import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-accent">
        404
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        Application not found
      </h1>
      <p className="mt-2 text-sm text-muted">
        The application you asked for does not exist, or it was never submitted.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:brightness-110"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
