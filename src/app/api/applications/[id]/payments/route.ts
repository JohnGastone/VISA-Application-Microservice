import { submitPayment } from "@/server/gateway";
import type { PaymentRequest } from "@/server/store";
import { fail, failFrom } from "@/server/respond";

const METHODS: PaymentRequest["method"][] = [
  "MOBILE_MONEY",
  "CARD",
  "BANK_TRANSFER",
];

export async function POST(
  request: Request,
  context: RouteContext<"/api/applications/[id]/payments">,
) {
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const method = body.method as PaymentRequest["method"];
  if (!METHODS.includes(method)) {
    return fail(`Payment method must be one of ${METHODS.join(", ")}.`, 422, {
      method: "Select a payment method.",
    });
  }

  const payerReference =
    typeof body.payerReference === "string" ? body.payerReference.trim() : "";
  if (!payerReference) {
    return fail("The payment could not be processed.", 422, {
      payerReference:
        method === "CARD"
          ? "Enter the card number."
          : "Enter the paying account or phone number.",
    });
  }

  try {
    return Response.json(
      await submitPayment(id, {
        method,
        payerReference,
        simulateFailure: body.simulateFailure === true,
      }),
      { status: 201 },
    );
  } catch (error) {
    return failFrom(error);
  }
}
