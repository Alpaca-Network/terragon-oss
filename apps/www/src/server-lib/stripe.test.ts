import { describe, expect, it } from "vitest";
import { getSafeStripeErrorMessage } from "./stripe";

// Helper to create a mock Stripe error (mimics Stripe SDK error structure)
function createMockStripeError(opts: {
  code?: string;
  type?: string;
  message?: string;
}): Error & { code?: string; type?: string } {
  const error = new Error(opts.message ?? "Mock error") as Error & {
    code?: string;
    type?: string;
  };
  error.name = "StripeInvalidRequestError";
  if (opts.code) error.code = opts.code;
  if (opts.type) error.type = opts.type;
  return error;
}

describe("getSafeStripeErrorMessage", () => {
  it("returns error code for Stripe errors with code", () => {
    const error = createMockStripeError({
      message: "No such price: 'price_xxx' - this should not be exposed",
      type: "invalid_request_error",
      code: "resource_missing",
    });
    expect(getSafeStripeErrorMessage(error)).toBe(
      "Stripe error: resource_missing",
    );
  });

  it("returns error type for Stripe errors without code", () => {
    const error = createMockStripeError({
      message: "Invalid API Key provided: sk_test_****xxxx",
      type: "authentication_error",
    });
    expect(getSafeStripeErrorMessage(error)).toBe(
      "Stripe error: authentication_error",
    );
  });

  it("returns generic message for regular Error objects", () => {
    const error = new Error(
      "Invalid API Key provided: sk_test_1234567890abcdef",
    );
    expect(getSafeStripeErrorMessage(error)).toBe(
      "An unexpected error occurred",
    );
  });

  it("returns generic message for string errors", () => {
    expect(getSafeStripeErrorMessage("Something went wrong")).toBe(
      "An unexpected error occurred",
    );
  });

  it("returns generic message for null/undefined", () => {
    expect(getSafeStripeErrorMessage(null)).toBe(
      "An unexpected error occurred",
    );
    expect(getSafeStripeErrorMessage(undefined)).toBe(
      "An unexpected error occurred",
    );
  });

  it("does not expose database connection strings", () => {
    const error = new Error(
      "Connection failed: postgres://user:password@localhost:5432/db",
    );
    const message = getSafeStripeErrorMessage(error);
    expect(message).not.toContain("postgres");
    expect(message).not.toContain("password");
    expect(message).toBe("An unexpected error occurred");
  });

  it("does not expose API keys in error messages", () => {
    const error = new Error("Invalid API key: sk_live_abc123xyz");
    const message = getSafeStripeErrorMessage(error);
    expect(message).not.toContain("sk_live");
    expect(message).not.toContain("abc123");
    expect(message).toBe("An unexpected error occurred");
  });
});
