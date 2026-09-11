import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationDetail } from "@/components/ApplicationDetail";
import { WorkflowError } from "@/server/store";
import { fetchApplication } from "@/server/gateway";

export const metadata: Metadata = {
  title: "Application status · Visa Application Portal",
};

// The status reflects live workflow state, so always render on request.
export const dynamic = "force-dynamic";

export default async function ApplicationPage(
  props: PageProps<"/applications/[id]">,
) {
  const { id } = await props.params;
  const { submitted } = await props.searchParams;

  let application;
  try {
    application = await fetchApplication(id);
  } catch (error) {
    if (error instanceof WorkflowError && error.statusCode === 404) notFound();
    throw error;
  }

  return (
    <ApplicationDetail
      initial={application}
      justSubmitted={submitted === "1"}
    />
  );
}
