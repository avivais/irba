import { afterEach, describe, expect, it } from "vitest";
import { AssistantApiError } from "./errors";
import { verifyAssistantAuth } from "./auth";

describe("verifyAssistantAuth", () => {
  afterEach(() => {
    delete process.env.ASSISTANT_API_SECRET;
  });

  it("accepts a valid bearer token", () => {
    process.env.ASSISTANT_API_SECRET = "s".repeat(32);
    expect(() => verifyAssistantAuth(`Bearer ${"s".repeat(32)}`)).not.toThrow();
  });

  it("rejects missing token", () => {
    process.env.ASSISTANT_API_SECRET = "s".repeat(32);
    expect(() => verifyAssistantAuth(null)).toThrow(AssistantApiError);
  });

  it("rejects wrong token", () => {
    process.env.ASSISTANT_API_SECRET = "s".repeat(32);
    expect(() => verifyAssistantAuth(`Bearer ${"x".repeat(32)}`)).toThrow(AssistantApiError);
  });

  it("fails closed when the secret is missing", () => {
    expect(() => verifyAssistantAuth("Bearer anything")).toThrow(AssistantApiError);
  });
});
