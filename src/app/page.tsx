import { Dashboard } from "@/components/Dashboard";
import { Alert } from "@/components/ui";
import { fetchApplications } from "@/server/gateway";

// Applications change with every workflow action, so never prerender this.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    return <Dashboard initial={await fetchApplications()} />;
  } catch (error) {
    return (
      <Alert tone="error" title="The visa services are unavailable">
        {error instanceof Error
          ? error.message
          : "Could not load applications."}
      </Alert>
    );
  }
}
