// The message a client shows for a failed API response. A 4xx `error` string is written for users (limits,
// validation, expired sessions) and is shown as is; a 5xx one may be an internal detail, so it never is.

export const GENERIC_ERROR = "Something went wrong on our side. Try again in a moment.";

export function errorMessage(status: number, error: string | undefined | null, fallback = GENERIC_ERROR): string {
  if (status >= 500) return GENERIC_ERROR;
  return status >= 400 && typeof error === "string" && error.trim() ? error : fallback;
}
