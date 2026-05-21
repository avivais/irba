import { describe, expect, it } from "vitest";
import { parseAssistantEnvelope } from "./schema";

const valid = {
  operation: "help",
  actor_phone: "+972501234567",
  group_jid: "120363409761679942@g.us",
  idempotency_key: "00000000-0000-4000-8000-000000000001",
  params: {},
};

describe("parseAssistantEnvelope", () => {
  it("accepts a valid envelope", () => {
    expect(parseAssistantEnvelope(valid)).toEqual(valid);
  });

  it("defaults missing params to an empty object", () => {
    const { params: _params, ...withoutParams } = valid;
    expect(parseAssistantEnvelope(withoutParams).params).toEqual({});
  });

  it("rejects invalid UUID", () => {
    expect(() =>
      parseAssistantEnvelope({ ...valid, idempotency_key: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects missing operation", () => {
    const { operation: _operation, ...withoutOperation } = valid;
    expect(() => parseAssistantEnvelope(withoutOperation)).toThrow();
  });

  it("rejects missing group JID", () => {
    const { group_jid: _groupJid, ...withoutGroup } = valid;
    expect(() => parseAssistantEnvelope(withoutGroup)).toThrow();
  });
});
