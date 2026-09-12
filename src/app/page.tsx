import { Dashboard } from "@/components/Dashboard";
import { Alert } from "@/components/ui";
import { fetchApplications } from "@/server/gateway";
import type { VisaApplication } from "@/lib/types";

// Applications change with every workflow action, so never prerender this.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let applications: VisaApplication[];
  try {
    applications = await fetchApplications();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load applications.";
    return (
      <Alert tone="error" title="The visa services are unavailable">
        {message}
      </Alert>
    );
  }

  return <Dashboard initial={applications} />;
}
