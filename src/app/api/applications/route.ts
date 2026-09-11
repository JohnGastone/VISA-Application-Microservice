import { toPayload, validateForm, type ApplicationFormValues } from "@/lib/validation";
import { fetchApplications, submitApplication } from "@/server/gateway";
import { fail, failFrom } from "@/server/respond";

export async function GET() {
  try {
    return Response.json(await fetchApplications());
  } catch (error) {
    return failFrom(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const values = normalise(body);
  const fields = validateForm(values);
  if (Object.keys(fields).length > 0) {
    return fail("The application could not be submitted.", 422, fields);
  }

  try {
    return Response.json(await submitApplication(toPayload(values)), {
      status: 201,
    });
  } catch (error) {
    return failFrom(error);
  }
}

/**
 * Flattens the wire payload into the flat shape the validator works on, so
 * the same rules guard the form and the endpoint.
 */
function normalise(body: unknown): ApplicationFormValues {
  const source = (body ?? {}) as Record<string, unknown>;
  const applicant = (source.applicant ?? source) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  return {
    fullname: text(applicant.fullname),
    passportNumber: text(applicant.passportNumber),
    country: text(applicant.country),
    gender: text(applicant.gender),
    phone: text(applicant.phone),
    email: text(applicant.email),
    visaType: text(source.visaType),
    expireDate: text(source.expireDate),
  };
}
