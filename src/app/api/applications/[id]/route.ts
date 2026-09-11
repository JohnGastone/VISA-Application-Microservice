import { fetchApplication } from "@/server/gateway";
import { failFrom } from "@/server/respond";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/applications/[id]">,
) {
  const { id } = await context.params;
  try {
    return Response.json(await fetchApplication(id));
  } catch (error) {
    return failFrom(error);
  }
}
