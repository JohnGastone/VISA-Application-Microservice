import { WorkflowError } from "./store";

/** Error envelope returned by every `/api/*` route. */
export interface ApiError {
  message: string;
  fields?: Record<string, string>;
}

export function fail(
  message: string,
  status: number,
  fields?: Record<string, string>,
): Response {
  return Response.json({ message, fields } satisfies ApiError, { status });
}

/** Turns a thrown value into the matching HTTP response. */
export function failFrom(error: unknown): Response {
  if (error instanceof WorkflowError) {
    return fail(error.message, error.statusCode);
  }
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected error talking to the visa services.";
  console.error("[visa-bff]", error);
  return fail(message, 502);
}
