"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { GENDERS, VISA_TYPES } from "@/lib/types";
import {
  COUNTRIES,
  EMPTY_FORM,
  toPayload,
  validateField,
  validateForm,
  type ApplicationFormValues,
  type FieldErrors,
} from "@/lib/validation";
import { Alert, Button, Card, CardHeader, Field } from "@/components/ui";

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

export default function ApplyPage() {
  const router = useRouter();
  const [values, setValues] = useState<ApplicationFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof ApplicationFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Re-validate as the user types, but only once the field has been left.
    if (touched[field]) {
      setErrors((current) => ({
        ...current,
        [field]: validateField(field, value),
      }));
    }
  };

  const blur = (field: keyof ApplicationFormValues) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: validateField(field, values[field]),
    }));
  };

  const errorFor = (field: keyof ApplicationFormValues) =>
    errors[field] || undefined;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const found = validateForm(values);
    setErrors(found);
    setTouched(
      Object.fromEntries(Object.keys(values).map((key) => [key, true])),
    );

    if (Object.keys(found).length > 0) {
      document
        .querySelector<HTMLElement>(`[aria-invalid="true"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const application = await api.submitApplication(toPayload(values));
      router.push(`/applications/${application.id}?submitted=1`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.fields) setErrors(caught.fields);
        setSubmitError(caught.message);
      } else {
        setSubmitError("The application could not be submitted.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          New visa application
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your details create an applicant profile and a visa application with
          status <code className="font-mono text-xs">PENDING</code>. The
          background check runs next.
        </p>
      </div>

      {submitError ? (
        <Alert tone="error" title="Submission failed">
          {submitError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Card>
          <CardHeader
            title="Applicant details"
            description="Stored by the Application Service in the applicant table."
          />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Field
              id="fullname"
              label="Full name"
              required
              error={errorFor("fullname")}
            >
              <input
                id="fullname"
                name="fullname"
                autoComplete="name"
                className="field-input"
                value={values.fullname}
                aria-invalid={Boolean(errorFor("fullname"))}
                aria-describedby={
                  errorFor("fullname") ? "fullname-error" : undefined
                }
                onChange={(event) => update("fullname", event.target.value)}
                onBlur={() => blur("fullname")}
                placeholder="Amina Hassan"
              />
            </Field>

            <Field
              id="passportNumber"
              label="Passport number"
              required
              hint="Letters and digits, must be unique."
              error={errorFor("passportNumber")}
            >
              <input
                id="passportNumber"
                name="passportNumber"
                className="field-input font-mono"
                value={values.passportNumber}
                aria-invalid={Boolean(errorFor("passportNumber"))}
                aria-describedby={
                  errorFor("passportNumber")
                    ? "passportNumber-error"
                    : "passportNumber-hint"
                }
                onChange={(event) =>
                  update("passportNumber", event.target.value.toUpperCase())
                }
                onBlur={() => blur("passportNumber")}
                placeholder="P1234567"
              />
            </Field>

            <Field
              id="country"
              label="Country of citizenship"
              required
              error={errorFor("country")}
            >
              <select
                id="country"
                name="country"
                className="field-input"
                value={values.country}
                aria-invalid={Boolean(errorFor("country"))}
                aria-describedby={
                  errorFor("country") ? "country-error" : undefined
                }
                onChange={(event) => update("country", event.target.value)}
                onBlur={() => blur("country")}
              >
                <option value="">Select a country</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="gender" label="Gender" required error={errorFor("gender")}>
              <select
                id="gender"
                name="gender"
                className="field-input"
                value={values.gender}
                aria-invalid={Boolean(errorFor("gender"))}
                aria-describedby={
                  errorFor("gender") ? "gender-error" : undefined
                }
                onChange={(event) => update("gender", event.target.value)}
                onBlur={() => blur("gender")}
              >
                <option value="">Select</option>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {GENDER_LABELS[gender]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="phone"
              label="Phone number"
              required
              hint="Include the country code."
              error={errorFor("phone")}
            >
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className="field-input"
                value={values.phone}
                aria-invalid={Boolean(errorFor("phone"))}
                aria-describedby={
                  errorFor("phone") ? "phone-error" : "phone-hint"
                }
                onChange={(event) => update("phone", event.target.value)}
                onBlur={() => blur("phone")}
                placeholder="+255 712 345 678"
              />
            </Field>

            <Field
              id="email"
              label="Email address"
              required
              hint="Used for all correspondence about this application."
              error={errorFor("email")}
            >
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="field-input"
                value={values.email}
                aria-invalid={Boolean(errorFor("email"))}
                aria-describedby={
                  errorFor("email") ? "email-error" : "email-hint"
                }
                onChange={(event) => update("email", event.target.value)}
                onBlur={() => blur("email")}
                placeholder="amina@example.com"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Visa details"
            description="Stored in the visa_application table with status PENDING."
          />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Field
              id="visaType"
              label="Visa type"
              required
              error={errorFor("visaType")}
            >
              <select
                id="visaType"
                name="visaType"
                className="field-input"
                value={values.visaType}
                aria-invalid={Boolean(errorFor("visaType"))}
                aria-describedby={
                  errorFor("visaType") ? "visaType-error" : undefined
                }
                onChange={(event) => update("visaType", event.target.value)}
                onBlur={() => blur("visaType")}
              >
                <option value="">Select a visa type</option>
                {VISA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="expireDate"
              label="Intended expiry date"
              required
              hint="The date the visa should remain valid until."
              error={errorFor("expireDate")}
            >
              <input
                id="expireDate"
                name="expireDate"
                type="date"
                className="field-input"
                value={values.expireDate}
                aria-invalid={Boolean(errorFor("expireDate"))}
                aria-describedby={
                  errorFor("expireDate") ? "expireDate-error" : "expireDate-hint"
                }
                onChange={(event) => update("expireDate", event.target.value)}
                onBlur={() => blur("expireDate")}
              />
            </Field>
          </div>

          <p className="border-t border-line bg-surface-muted px-5 py-4 text-xs text-muted">
            The fee is set by the Payment Service and quoted once the background
            check clears. Nothing is charged now.
          </p>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
