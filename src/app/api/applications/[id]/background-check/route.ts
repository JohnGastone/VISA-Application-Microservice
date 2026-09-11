import { requestBackgroundCheck } from "@/server/gateway";
import { failFrom } from "@/server/respond";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/applications/[id]/background-check">,
) {
  const { id } = await context.params;
  try {
    return Response.json(await requestBackgroundCheck(id));
  } catch (error) {
    return failFrom(error);
  }
}
