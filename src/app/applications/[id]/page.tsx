import { ApplicationDetail } from "@/components/ApplicationDetail";

export const metadata = {
  title: "Application status · Visa Application Portal",
};

export default async function ApplicationPage(
  props: PageProps<"/applications/[id]">,
) {
  const { id } = await props.params;
  const { submitted } = await props.searchParams;

  return <ApplicationDetail id={id} justSubmitted={submitted === "1"} />;
}
