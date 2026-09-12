"use client";

import Link from "next/link";
import { Alert, Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16">
      <Alert tone="error" title="Something went wrong">
        {error.message ||
          "The visa services could not complete that request. Try again in a moment."}
      </Alert>
      <div className="flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
