import {
  GENDERS,
  VISA_TYPES,
  type Gender,
  type SubmitApplicationPayload,
  type VisaType,
} from "./types";

/**
 * Strict email format validation, mirrored by the Applicant entity constraint
 * on the Application Service.
 */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/**
 * Passport numbers: 4-20 alphanumerics, e.g. P1234567. Kept deliberately
 * permissive to match what the services accept.
 */
export const PASSPORT_PATTERN = /^[A-Za-z0-9]{4,20}$/;

/** E.164-ish: optional +, 9-20 digits, spaces and dashes tolerated. */
export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{7,18}[0-9]$/;

export type FieldErrors = Record<string, string>;

export interface ApplicationFormValues {
  fullname: string;
  passportNumber: string;
  country: string;
  gender: string;
  phone: string;
  email: string;
  visaType: string;
  expireDate: string;
}

export const EMPTY_FORM: ApplicationFormValues = {
  fullname: "",
  passportNumber: "",
  country: "",
  gender: "",
  phone: "",
  email: "",
  visaType: "",
  expireDate: "",
};

/**
 * Validates one field. Returns an empty string when valid, so callers can
 * assign the result straight into a `FieldErrors` map.
 */
export function validateField(
  field: keyof ApplicationFormValues,
  value: string,
): string {
  const trimmed = value.trim();

  switch (field) {
    case "fullname":
      if (!trimmed) return "Full name is required.";
      if (trimmed.length < 3) return "Full name must be at least 3 characters.";
      if (!/^[A-Za-z\s'.-]+$/.test(trimmed))
        return "Use letters, spaces, apostrophes, dots or hyphens only.";
      return "";

    case "passportNumber":
      if (!trimmed) return "Passport number is required.";
      if (!PASSPORT_PATTERN.test(trimmed))
        return "Passport number must be 4-20 letters or digits.";
      return "";

    case "country":
      if (!trimmed) return "Country is required.";
      return "";

    case "gender":
      if (!trimmed) return "Gender is required.";
      if (!GENDERS.includes(trimmed as Gender)) return "Select a valid gender.";
      return "";

    case "phone":
      if (!trimmed) return "Phone number is required.";
      if (!PHONE_PATTERN.test(trimmed))
        return "Enter a valid phone number, e.g. +255 712 345 678.";
      return "";

    case "email":
      if (!trimmed) return "Email address is required.";
      if (!EMAIL_PATTERN.test(trimmed))
        return "Enter a valid email address, e.g. amina@example.com.";
      return "";

    case "visaType":
      if (!trimmed) return "Visa type is required.";
      if (!VISA_TYPES.includes(trimmed as VisaType))
        return "Select a valid visa type.";
      return "";

    case "expireDate": {
      if (!trimmed) return "Intended expiry date is required.";
      const date = new Date(trimmed);
      if (Number.isNaN(date.getTime())) return "Enter a valid date.";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date <= today) return "Expiry date must be in the future.";
      return "";
    }

    default:
      return "";
  }
}

/** Validates the whole form, returning only the fields that failed. */
export function validateForm(values: ApplicationFormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of Object.keys(values) as (keyof ApplicationFormValues)[]) {
    const error = validateField(key, values[key]);
    if (error) errors[key] = error;
  }
  return errors;
}

/** Maps validated form values onto the submission payload. */
export function toPayload(
  values: ApplicationFormValues,
): SubmitApplicationPayload {
  return {
    applicant: {
      fullname: values.fullname.trim(),
      passportNumber: values.passportNumber.trim().toUpperCase(),
      country: values.country.trim(),
      gender: values.gender as Gender,
      phone: values.phone.trim(),
      email: values.email.trim().toLowerCase(),
    },
    visaType: values.visaType as VisaType,
    expireDate: values.expireDate,
  };
}

/** Countries offered by the form's country picker. */
export const COUNTRIES = [
  "Tanzania",
  "Kenya",
  "Uganda",
  "Rwanda",
  "Burundi",
  "Democratic Republic of the Congo",
  "Zambia",
  "Malawi",
  "Mozambique",
  "South Africa",
  "Nigeria",
  "Ghana",
  "Ethiopia",
  "Egypt",
  "India",
  "China",
  "Japan",
  "United Arab Emirates",
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Canada",
  "United States",
  "Brazil",
  "Australia",
];
