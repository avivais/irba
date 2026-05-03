import { describe, expect, it } from "vitest";
import { phoneToWaMention, renderTemplate } from "./wa-notify";

describe("renderTemplate", () => {
  it("replaces a single placeholder", () => {
    expect(renderTemplate("שלום {name}", { name: "אבי" })).toBe("שלום אבי");
  });

  it("replaces multiple placeholders", () => {
    const result = renderTemplate("{player_name} נרשם למפגש {date} ({status})", {
      player_name: "דניאל",
      date: "יום שני 7 אפריל",
      status: "מאושר",
    });
    expect(result).toBe("דניאל נרשם למפגש יום שני 7 אפריל (מאושר)");
  });

  it("leaves unknown placeholders as-is", () => {
    expect(renderTemplate("שלום {unknown}", { name: "אבי" })).toBe("שלום {unknown}");
  });

  it("handles a template with no placeholders", () => {
    expect(renderTemplate("הודעה קבועה", {})).toBe("הודעה קבועה");
  });

  it("replaces the same placeholder multiple times", () => {
    expect(renderTemplate("{date} and {date}", { date: "Monday" })).toBe("Monday and Monday");
  });

  it("handles empty string vars", () => {
    expect(renderTemplate("שלום {name}!", { name: "" })).toBe("שלום !");
  });

  it("does not alter surrounding text when replacing", () => {
    expect(renderTemplate("ההרשמה למפגש {date} פתוחה!", { date: "יום שני" })).toBe(
      "ההרשמה למפגש יום שני פתוחה!",
    );
  });

  it("substitutes a multi-line value into a single placeholder", () => {
    const template = "נרשמו עד כה:\n{registered_list}\n\nברשימת המתנה:\n{waitlist}";
    const result = renderTemplate(template, {
      registered_list: ["אבי", "דניאל", "רונן"].join("\n"),
      waitlist: ["זאב"].join("\n"),
    });
    expect(result).toBe(
      "נרשמו עד כה:\nאבי\nדניאל\nרונן\n\nברשימת המתנה:\nזאב",
    );
  });

  it("renders an empty waitlist as an empty string", () => {
    const template = "נרשמו עד כה:\n{registered_list}\n\nברשימת המתנה:\n{waitlist}";
    const result = renderTemplate(template, {
      registered_list: ["אבי"].join("\n"),
      waitlist: [].join("\n"),
    });
    expect(result).toBe("נרשמו עד כה:\nאבי\n\nברשימת המתנה:\n");
  });
});

describe("phoneToWaMention", () => {
  it("converts a normalised Israeli mobile to digits + JID", () => {
    expect(phoneToWaMention("0501234567")).toEqual({
      digits: "972501234567",
      jid: "972501234567@s.whatsapp.net",
    });
  });

  it("returns null for malformed phones", () => {
    expect(phoneToWaMention("123")).toBeNull();
    expect(phoneToWaMention("0521234567abc")).toBeNull();
    expect(phoneToWaMention("+972501234567")).toBeNull(); // non-normalised
    expect(phoneToWaMention("")).toBeNull();
  });

  it("returns null for non-mobile prefixes", () => {
    expect(phoneToWaMention("0312345678")).toBeNull(); // landline
    expect(phoneToWaMention("0411234567")).toBeNull(); // not 05XX
  });
});
